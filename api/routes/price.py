"""
/api/price  — Live ticker price + Greeks (POST)
/api/compute — Raw parameter Greeks, no network calls (GET)

The /compute endpoint is designed for the dashboard's real-time Greeks sliders:
it takes S, K, T, r, sigma directly and returns instantly without hitting
any external APIs.

The /price endpoint fetches a live spot price, the current risk-free rate, and
optionally computes 30-day historical vol when sigma is not supplied.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from pricing.black_scholes import greeks as bs_greeks
from pricing.market_data import expiry_to_years, get_risk_free_rate, get_spot_price, historical_vol

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PriceRequest(BaseModel):
    ticker: str = Field(..., examples=["SPY"])
    strike: float = Field(..., gt=0, examples=[545.0])
    expiry: str = Field(..., examples=["2025-09-19"], description="YYYY-MM-DD")
    option_type: str = Field("call", pattern="^(call|put)$")
    sigma: Optional[float] = Field(
        None, gt=0, le=5.0,
        description="Annualised volatility as a decimal. Omit to use 30-day historical vol.",
    )


class GreeksOut(BaseModel):
    ticker: str
    spot: float
    strike: float
    expiry: str
    T: float
    r: float
    sigma: float
    sigma_source: str
    option_type: str
    price: float
    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float


class ComputeOut(BaseModel):
    price: float
    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/price", response_model=GreeksOut, summary="Live price + Greeks for a real ticker")
def get_price(req: PriceRequest):
    """
    Fetch the live spot price and risk-free rate, then return the
    Black-Scholes theoretical price and all five Greeks.

    If `sigma` is omitted, 30-day annualised historical volatility is
    computed from yfinance daily closes.
    """
    try:
        S = get_spot_price(req.ticker)
        r = get_risk_free_rate()
        T = expiry_to_years(req.expiry)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Market data unavailable: {exc}")

    if req.sigma is not None:
        sigma = req.sigma
        sigma_source = "user_provided"
    else:
        try:
            sigma = historical_vol(req.ticker)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        sigma_source = "30d_historical"

    g = bs_greeks(S, req.strike, T, r, sigma, req.option_type)

    return GreeksOut(
        ticker=req.ticker.upper(),
        spot=round(S, 4),
        strike=req.strike,
        expiry=req.expiry,
        T=round(T, 6),
        r=round(r, 6),
        sigma=round(sigma, 6),
        sigma_source=sigma_source,
        option_type=req.option_type,
        price=round(g["price"], 6),
        delta=round(g["delta"], 6),
        gamma=round(g["gamma"], 6),
        vega=round(g["vega"], 6),
        theta=round(g["theta"], 6),
        rho=round(g["rho"], 6),
    )


@router.get("/compute", response_model=ComputeOut, summary="Instant Greeks from raw parameters")
def compute(
    S: float = Query(..., gt=0, description="Spot price"),
    K: float = Query(..., gt=0, description="Strike price"),
    T: float = Query(..., gt=0, description="Time to expiry in years"),
    r: float = Query(0.05, description="Risk-free rate"),
    sigma: float = Query(..., gt=0, le=5.0, description="Volatility"),
    option_type: str = Query("call", pattern="^(call|put)$"),
):
    """
    Pure Black-Scholes computation — no market data fetched.
    Designed for the dashboard's real-time Greeks sliders.
    """
    try:
        g = bs_greeks(S, K, T, r, sigma, option_type)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return ComputeOut(
        price=round(g["price"], 6),
        delta=round(g["delta"], 6),
        gamma=round(g["gamma"], 6),
        vega=round(g["vega"], 6),
        theta=round(g["theta"], 6),
        rho=round(g["rho"], 6),
    )
