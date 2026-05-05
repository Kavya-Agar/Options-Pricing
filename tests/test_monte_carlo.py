"""
Test suite for the Monte Carlo options pricer.

Monte Carlo tests require a different philosophy than Black-Scholes tests:
the results are random, so we can't check for exact values. Instead we check:
  1. Convergence — MC price approaches BS price as n_sims grows
  2. Statistical validity — the true price falls within the confidence interval
  3. Variance reduction — antithetic variates produce lower std error
  4. Boundary conditions — call/put relationship, input validation

How to run:
    pytest tests/ -v

Note on seeds: all tests that check numerical values fix the random seed
for reproducibility. Tests without seeds check structural properties only.
"""

import pytest
import numpy as np
from pricing.monte_carlo import mc_price, mc_convergence
from pricing.black_scholes import bs_price


# Standard test parameters — ATM option, 1 year, 5% rate, 20% vol
BASE = dict(S=100.0, K=100.0, T=1.0, r=0.05, sigma=0.20)
BS_CALL = bs_price(**BASE, option_type="call")
BS_PUT  = bs_price(**BASE, option_type="put")


class TestMCPrice:
    """
    Tests for the core mc_price() function.
    """

    def test_returns_expected_keys(self):
        """Result dict must contain all expected fields."""
        result = mc_price(**BASE, option_type="call", n_sims=1000, seed=42)
        for key in ("price", "std_error", "conf_low", "conf_high", "n_sims"):
            assert key in result, f"Missing key '{key}'"

    def test_confidence_interval_ordered(self):
        """conf_low must be strictly less than conf_high."""
        result = mc_price(**BASE, option_type="call", n_sims=1000, seed=42)
        assert result["conf_low"] < result["price"] < result["conf_high"]

    def test_price_is_non_negative(self):
        """Option prices can never be negative."""
        for opt in ("call", "put"):
            result = mc_price(**BASE, option_type=opt, n_sims=5000, seed=0)
            assert result["price"] >= 0, f"{opt} price was negative: {result['price']}"

    def test_call_convergence_to_bs(self):
        """
        With 100,000 simulations the MC estimate should be within ~$0.10 of BS.
        This is a loose tolerance — MC is a statistical estimator, not exact.
        Tightening to $0.02 would require ~1M sims for reliable passing.
        """
        result = mc_price(**BASE, option_type="call", n_sims=100_000, seed=42)
        assert abs(result["price"] - BS_CALL) < 0.10

    def test_put_convergence_to_bs(self):
        result = mc_price(**BASE, option_type="put", n_sims=100_000, seed=42)
        assert abs(result["price"] - BS_PUT) < 0.10

    def test_bs_price_within_confidence_interval(self):
        """
        For a well-calibrated estimator, the true value (BS price) should fall
        inside the 95% confidence interval approximately 95% of the time.
        With a fixed seed we verify this for a specific run — it should hold
        with very high probability for any reasonably-sized simulation.
        """
        result = mc_price(**BASE, option_type="call", n_sims=50_000, seed=42)
        assert result["conf_low"] < BS_CALL < result["conf_high"], (
            f"BS price {BS_CALL:.4f} not in CI "
            f"[{result['conf_low']:.4f}, {result['conf_high']:.4f}]"
        )

    def test_put_call_parity_holds_approximately(self):
        """
        Put-call parity: C - P = S - K * e^(-rT)
        The MC estimators for C and P have independent sampling error,
        so we allow a generous tolerance here.
        """
        import math
        call_r = mc_price(**BASE, option_type="call", n_sims=100_000, seed=1)
        put_r  = mc_price(**BASE, option_type="put",  n_sims=100_000, seed=1)
        lhs = call_r["price"] - put_r["price"]
        rhs = BASE["S"] - BASE["K"] * math.exp(-BASE["r"] * BASE["T"])
        assert abs(lhs - rhs) < 0.20  # generous: two independent MC estimates

    def test_invalid_option_type_raises(self):
        with pytest.raises(ValueError, match="option_type"):
            mc_price(**BASE, option_type="straddle")

    def test_invalid_time_raises(self):
        with pytest.raises(ValueError, match="Time to expiry"):
            mc_price(S=100, K=100, T=-1, r=0.05, sigma=0.20)

    def test_invalid_vol_raises(self):
        with pytest.raises(ValueError, match="Volatility"):
            mc_price(S=100, K=100, T=1.0, r=0.05, sigma=0.0)

    def test_invalid_n_sims_raises(self):
        with pytest.raises(ValueError, match="n_sims"):
            mc_price(**BASE, n_sims=0)

    def test_reproducible_with_seed(self):
        """Same seed → identical output."""
        r1 = mc_price(**BASE, option_type="call", n_sims=10_000, seed=99)
        r2 = mc_price(**BASE, option_type="call", n_sims=10_000, seed=99)
        assert r1["price"] == r2["price"]

    def test_different_seeds_give_different_results(self):
        """Different seeds should (almost certainly) give different results."""
        r1 = mc_price(**BASE, option_type="call", n_sims=1000, seed=1)
        r2 = mc_price(**BASE, option_type="call", n_sims=1000, seed=2)
        assert r1["price"] != r2["price"]

    def test_deep_otm_call_near_zero(self):
        """
        A deep OTM call (spot far below strike) should price near zero.
        Almost no simulated paths will end in the money.
        """
        result = mc_price(S=50, K=200, T=0.5, r=0.05, sigma=0.20, option_type="call",
                          n_sims=50_000, seed=42)
        assert result["price"] < 0.05

    def test_deep_itm_call_near_intrinsic(self):
        """
        A deep ITM call (spot far above strike) should approach its intrinsic value.
        Almost all simulated paths end in the money.
        """
        import math
        result = mc_price(S=200, K=100, T=1.0, r=0.05, sigma=0.20, option_type="call",
                          n_sims=50_000, seed=42)
        intrinsic = 200 - 100 * math.exp(-0.05)
        assert abs(result["price"] - intrinsic) < 1.0


class TestAntithetVariates:
    """
    Tests specifically for the antithetic variates variance reduction technique.

    Antithetic variates pair each random draw Z with its mirror -Z.
    Since call payoffs from Z and -Z are negatively correlated (one goes up,
    the other goes down), averaging them cancels out some of the variance.
    """

    def test_antithetic_lower_std_error_than_standard(self):
        """
        Antithetic variates should consistently produce a lower standard error
        than plain Monte Carlo with the same number of simulations.
        We test this across multiple seeds to avoid lucky/unlucky draws.
        """
        anti_errors = []
        std_errors  = []

        for seed in range(10):
            r_anti = mc_price(**BASE, option_type="call", n_sims=5_000,
                              antithetic=True, seed=seed)
            r_std  = mc_price(**BASE, option_type="call", n_sims=5_000,
                              antithetic=False, seed=seed)
            anti_errors.append(r_anti["std_error"])
            std_errors.append(r_std["std_error"])

        # On average, antithetic should be meaningfully more precise
        assert np.mean(anti_errors) < np.mean(std_errors), (
            f"Antithetic mean std error {np.mean(anti_errors):.5f} was not less than "
            f"standard mean std error {np.mean(std_errors):.5f}"
        )

    def test_antithetic_not_biased(self):
        """
        Antithetic variates reduce variance but must not introduce bias.
        Both estimators should converge to the same BS price.
        """
        r_anti = mc_price(**BASE, option_type="call", n_sims=100_000,
                          antithetic=True, seed=42)
        r_std  = mc_price(**BASE, option_type="call", n_sims=100_000,
                          antithetic=False, seed=42)
        assert abs(r_anti["price"] - BS_CALL) < 0.10
        assert abs(r_std["price"]  - BS_CALL) < 0.10


class TestMCConvergence:
    """
    Tests for the mc_convergence() function, which tracks how the MC
    estimate improves as the number of simulations increases.

    The key result: error shrinks proportionally to 1/sqrt(n_sims).
    This is the Monte Carlo convergence rate — universal, regardless of
    the number of dimensions in the problem (unlike finite-difference methods).
    """

    def test_returns_one_row_per_sim_count(self):
        counts = [100, 1000, 10_000]
        rows = mc_convergence(**BASE, option_type="call", sim_counts=counts, seed=42)
        assert len(rows) == len(counts)

    def test_each_row_has_expected_keys(self):
        rows = mc_convergence(**BASE, option_type="call", sim_counts=[1000], seed=42)
        for key in ("n_sims", "mc_price", "bs_price", "error", "std_error"):
            assert key in rows[0], f"Missing key '{key}'"

    def test_bs_price_consistent_across_rows(self):
        """The analytical BS price should be the same in every row."""
        rows = mc_convergence(**BASE, option_type="call",
                              sim_counts=[100, 1000, 10_000], seed=42)
        bs_prices = [row["bs_price"] for row in rows]
        assert all(abs(p - bs_prices[0]) < 1e-10 for p in bs_prices)

    def test_error_generally_decreases_with_more_sims(self):
        """
        With antithetic variates and a fixed seed, the MC error should generally
        decrease as more simulations are used. We test the trend, not each step —
        individual steps can go up due to randomness, but the overall trend must
        be downward.
        """
        counts = [500, 2_000, 10_000, 50_000]
        rows = mc_convergence(**BASE, option_type="call", sim_counts=counts, seed=42)
        errors = [row["error"] for row in rows]

        # The last entry should have lower error than the first
        assert errors[-1] < errors[0], (
            f"Error did not decrease from {errors[0]:.4f} to {errors[-1]:.4f}"
        )

    def test_large_n_converges_to_bs(self):
        """
        At 50,000 simulations, the MC price should be within $0.10 of BS.
        """
        rows = mc_convergence(**BASE, option_type="call",
                              sim_counts=[50_000], seed=42)
        assert rows[0]["error"] < 0.10
