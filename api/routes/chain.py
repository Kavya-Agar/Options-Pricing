"""
/api/chain  — Full options chain enriched with IV and Black-Scholes mispricing (GET)
/api/expiries — Available expiry dates for a ticker (GET)
"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from pricing.black_scholes import bs_price
from pricing.iv_solver import full_chain_with_iv
from pricing.market_data import expiry_to_years, get_options_chain, get_risk_free_rate, get_spot_price

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ContractOut(BaseModel):
    strike: float
    option_type: str
    market_price: float
    bs_price: float
    mispricing: float       # bs_price − market_price
    iv: Optional[float]     # Brent's-method IV
    yf_iv: Optional[float]  # yfinance's own estimate (for comparison)
    bid: float
    ask: float
    volume: Optional[float]
    open_interest: Optional[float]


class ChainResponse(BaseModel):
    ticker: str
    expiry: str
    T: float
    spot: float
    r: float
    contracts: List[ContractOut]


class ExpiriesResponse(BaseModel):
    ticker: str
    expiries: List[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mid(row) -> float:
    bid = float(row.get("bid", 0) or 0)
    ask = float(row.get("ask", 0) or 0)
    if bid > 0 and ask > 0:
        return (bid + ask) / 2.0
    return float(row.get("lastPrice", 0) or 0)


def _opt(val) -> Optional[float]:
    """Return rounded float or None for zero / NaN values."""
    try:
        f = float(val or 0)
        return round(f, 4) if f else None
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/expiries", response_model=ExpiriesResponse, summary="Available expiry dates for a ticker")
def get_expiries(ticker: str = Query(..., examples=["SPY"])):
    try:
        _, _, available, _ = get_options_chain(ticker)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Market data unavailable: {exc}")
    return ExpiriesResponse(ticker=ticker.upper(), expiries=available)


@router.get("/chain", response_model=ChainResponse, summary="Options chain with IV and BS mispricing")
def get_chain(
    ticker: str = Query(..., examples=["SPY"]),
    expiry: Optional[str] = Query(None, description="YYYY-MM-DD. Defaults to nearest available expiry."),
):
    """
    Returns the full options chain for a ticker enriched with:
      - **IV** — implied volatility solved via Brent's method
      - **bs_price** — Black-Scholes theoretical price at that IV
      - **mispricing** — `bs_price − market_price` (positive = overpriced by BS)

    Contracts with no valid bid/ask/lastPrice are excluded.
    """
    try:
        S = get_spot_price(ticker)
        r = get_risk_free_rate()
        calls, puts, _, selected_expiry = get_options_chain(ticker, expiry)
        T = expiry_to_years(selected_expiry)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Market data unavailable: {exc}")

    calls_iv, puts_iv = full_chain_with_iv(calls, puts, S=S, T=T, r=r)

    contracts: List[ContractOut] = []
    for df, opt_type in [(calls_iv, "call"), (puts_iv, "put")]:
        for _, row in df.iterrows():
            mid = _mid(row)
            if mid <= 0:
                continue

            # Use solved IV if available; fall back to 20% for the BS price display
            iv_val = row.get("iv")
            sigma_for_bs = float(iv_val) if iv_val is not None else 0.20
            theo = bs_price(S, float(row["strike"]), T, r, sigma_for_bs, opt_type)

            contracts.append(ContractOut(
                strike=round(float(row["strike"]), 2),
                option_type=opt_type,
                market_price=round(mid, 4),
                bs_price=round(theo, 4),
                mispricing=round(theo - mid, 4),
                iv=round(float(iv_val), 4) if iv_val is not None else None,
                yf_iv=_opt(row.get("impliedVolatility")),
                bid=round(float(row.get("bid", 0) or 0), 4),
                ask=round(float(row.get("ask", 0) or 0), 4),
                volume=_opt(row.get("volume")),
                open_interest=_opt(row.get("openInterest")),
            ))

    contracts.sort(key=lambda c: (c.strike, c.option_type))

    return ChainResponse(
        ticker=ticker.upper(),
        expiry=selected_expiry,
        T=round(T, 6),
        spot=round(S, 4),
        r=round(r, 6),
        contracts=contracts,
    )
