"""
Monte Carlo Options Pricer
==========================
Phase 2 of the Options Pricing Engine project.

Monte Carlo pricing simulates many possible future stock price paths and
estimates the option value as the average discounted payoff across all paths.
For European options, this should converge to the Black-Scholes price as the
number of simulations grows — a key validation of the approach.

Why use Monte Carlo if Black-Scholes gives an exact answer?
  - BS only works for European options under strict assumptions.
  - Monte Carlo works for ANY payoff (Asian, barrier, American with tweaks)
    and can incorporate stochastic volatility, jumps, dividends, etc.
  - It's the industry standard for complex exotic derivatives.

The model: Geometric Brownian Motion (GBM)
------------------------------------------
Under the risk-neutral measure, the stock price follows:

    dS = r * S * dt + sigma * S * dW

where dW is a Wiener process (random normal shock). Solving this SDE gives
the exact terminal distribution — no need to simulate intermediate steps
for European options:

    S_T = S * exp((r - 0.5 * sigma^2) * T + sigma * sqrt(T) * Z)

where Z ~ N(0, 1).

The (r - 0.5 * sigma^2) drift term uses the risk-neutral rate r, not the
real-world expected return. This is the core of risk-neutral pricing: we
price as if investors are indifferent to risk, which lets us discount at r.
The -0.5*sigma^2 is an Itô correction — it appears because log-normal
variance causes the mean log return to be less than the drift.

Variance Reduction: Antithetic Variates
----------------------------------------
For every random draw Z, we also compute the path with -Z. Since the payoffs
from Z and -Z are negatively correlated, averaging them reduces variance
without adding bias. This roughly halves the number of simulations needed
for the same accuracy — a simple but powerful technique.

Parameters used throughout this module:
  S           : Current spot price
  K           : Strike price
  T           : Time to expiry in years
  r           : Risk-free interest rate (continuously compounded)
  sigma       : Volatility
  n_sims      : Number of simulation paths (10,000–100,000 typical)
  option_type : "call" or "put"
  seed        : Optional random seed for reproducibility
"""

import numpy as np
from typing import Optional


def mc_price(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    option_type: str = "call",
    n_sims: int = 50_000,
    antithetic: bool = True,
    seed: Optional[int] = None,
) -> dict:
    """
    Price a European option using Monte Carlo simulation of GBM.

    Args:
        S           : Spot price
        K           : Strike price
        T           : Time to expiry in years
        r           : Risk-free rate (continuously compounded)
        sigma       : Volatility
        option_type : "call" or "put"
        n_sims      : Number of simulation paths
        antithetic  : If True, use antithetic variates for variance reduction
        seed        : Random seed for reproducibility (None = random)

    Returns:
        Dict with keys:
            price      : MC estimate of the option price
            std_error  : Standard error of the estimate (measure of precision)
            conf_low   : Lower bound of 95% confidence interval
            conf_high  : Upper bound of 95% confidence interval
            n_sims     : Number of paths used

    The standard error shrinks at rate 1/sqrt(n_sims). Doubling precision
    requires 4x the simulations — this is why variance reduction matters.
    """
    option_type = option_type.lower().strip()
    if option_type not in ("call", "put"):
        raise ValueError(f"option_type must be 'call' or 'put', got '{option_type}'.")
    if T <= 0:
        raise ValueError("Time to expiry T must be positive.")
    if sigma <= 0:
        raise ValueError("Volatility sigma must be positive.")
    if n_sims < 1:
        raise ValueError("n_sims must be at least 1.")

    rng = np.random.default_rng(seed)

    # --- Simulate terminal stock prices ---
    #
    # We only need S_T (terminal price), not intermediate path points,
    # because European option payoff depends only on price at expiry.
    #
    # GBM terminal price formula:
    #   S_T = S * exp( (r - 0.5*sigma^2)*T  +  sigma*sqrt(T)*Z )
    #              └── deterministic drift ──┘  └── random shock ──┘

    drift = (r - 0.5 * sigma ** 2) * T
    diffusion_scale = sigma * np.sqrt(T)

    if antithetic:
        # Draw n_sims/2 random normals, then pair each Z with -Z.
        # This ensures the sample mean of Z is exactly 0, removing a
        # source of sampling error (control on the first moment).
        half = (n_sims + 1) // 2  # ceiling division handles odd n_sims
        Z = rng.standard_normal(half)
        Z_all = np.concatenate([Z, -Z])[:n_sims]
    else:
        Z_all = rng.standard_normal(n_sims)

    S_T = S * np.exp(drift + diffusion_scale * Z_all)

    # --- Compute payoffs ---
    #
    # Call payoff: max(S_T - K, 0) — profit if stock ends above strike
    # Put payoff:  max(K - S_T, 0) — profit if stock ends below strike
    if option_type == "call":
        payoffs = np.maximum(S_T - K, 0.0)
    else:
        payoffs = np.maximum(K - S_T, 0.0)

    # --- Discount to present value and average ---
    #
    # Risk-neutral pricing: price = e^(-rT) * E[payoff]
    # We estimate the expectation with the sample average.
    discount = np.exp(-r * T)
    discounted = discount * payoffs

    price = discounted.mean()

    # --- Standard error and confidence interval ---
    #
    # The Central Limit Theorem tells us the sample mean is approximately
    # normal with std = (sample std) / sqrt(n). The 95% CI uses z=1.96.
    std_error = discounted.std(ddof=1) / np.sqrt(n_sims)
    conf_low  = price - 1.96 * std_error
    conf_high = price + 1.96 * std_error

    return {
        "price":     float(price),
        "std_error": float(std_error),
        "conf_low":  float(conf_low),
        "conf_high": float(conf_high),
        "n_sims":    n_sims,
    }


def mc_convergence(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    option_type: str = "call",
    sim_counts: Optional[list] = None,
    seed: int = 42,
) -> list[dict]:
    """
    Run Monte Carlo at increasing simulation counts and track convergence to
    the Black-Scholes analytical price.

    This is the key validation: as n_sims → ∞, the MC price must converge
    to the BS price. The rate of convergence is O(1/sqrt(n)) — halving the
    error costs 4x the computation.

    Args:
        S, K, T, r, sigma : Option parameters
        option_type       : "call" or "put"
        sim_counts        : List of n_sims values to evaluate
                            (defaults to [100, 500, 1000, 5000, 10000, 50000])
        seed              : Fixed seed so results are reproducible

    Returns:
        List of dicts, one per sim count, each containing:
            n_sims    : Number of paths
            mc_price  : Monte Carlo estimate
            bs_price  : Black-Scholes analytical price
            error     : abs(mc_price - bs_price)
            std_error : Monte Carlo standard error
    """
    from .black_scholes import bs_price  # local import avoids circular dependency

    if sim_counts is None:
        sim_counts = [100, 500, 1_000, 5_000, 10_000, 50_000]

    analytical = bs_price(S, K, T, r, sigma, option_type)
    results = []

    for n in sim_counts:
        result = mc_price(S, K, T, r, sigma, option_type, n_sims=n, antithetic=True, seed=seed)
        results.append({
            "n_sims":    n,
            "mc_price":  result["price"],
            "bs_price":  analytical,
            "error":     abs(result["price"] - analytical),
            "std_error": result["std_error"],
        })

    return results


# ---------------------------------------------------------------------------
# Quick demo — run this file directly to see sample output
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from pricing.black_scholes import bs_price

    S, K, T, r, sigma = 100.0, 100.0, 1.0, 0.05, 0.20

    print("=" * 65)
    print("  Monte Carlo Pricer vs. Black-Scholes — Convergence Demo")
    print("  S=100  K=100  T=1yr  r=5%  σ=20%  (ATM Call)")
    print("=" * 65)
    print(f"  {'N Sims':>10}  {'MC Price':>10}  {'BS Price':>10}  {'Error':>10}  {'Std Err':>10}")
    print(f"  {'-'*10}  {'-'*10}  {'-'*10}  {'-'*10}  {'-'*10}")

    rows = mc_convergence(S, K, T, r, sigma, "call")
    for row in rows:
        print(
            f"  {row['n_sims']:>10,}  "
            f"{row['mc_price']:>10.4f}  "
            f"{row['bs_price']:>10.4f}  "
            f"{row['error']:>10.4f}  "
            f"{row['std_error']:>10.4f}"
        )

    print()
    print("  Antithetic vs. Standard — variance reduction demo (10,000 sims)")
    print(f"  {'Method':>20}  {'Price':>10}  {'Std Error':>10}")
    print(f"  {'-'*20}  {'-'*10}  {'-'*10}")
    for use_anti, label in [(False, "Standard"), (True, "Antithetic")]:
        r_ = mc_price(S, K, T, r, sigma, "call", n_sims=10_000, antithetic=use_anti, seed=42)
        print(f"  {label:>20}  {r_['price']:>10.4f}  {r_['std_error']:>10.4f}")

    print("=" * 65)
