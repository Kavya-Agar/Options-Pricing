"""
Options Pricing Engine
======================
A from-scratch implementation of quantitative options pricing models.

Modules
-------
black_scholes   Closed-form BS price and all five Greeks (Phase 1)
monte_carlo     GBM simulation pricer with antithetic variance reduction (Phase 2)
"""

from .black_scholes import bs_price, greeks, delta, gamma, vega, theta, rho
from .monte_carlo import mc_price, mc_convergence

__all__ = [
    "bs_price", "greeks", "delta", "gamma", "vega", "theta", "rho",
    "mc_price", "mc_convergence",
]
