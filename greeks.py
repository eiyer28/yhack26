"""
Binary cash-or-nothing option pricing and Greeks.

Formulae sourced from:
https://www.quantpie.co.uk/bsm_bin_c_formula/bs_bin_c_summary.php

A binary cash-or-nothing call pays $1 if S > K at expiry, $0 otherwise.
Price = e^(-r*T) * N(d2)

Generalized form uses phi = +1 for calls, -1 for puts.

Variables:
    S     : current underlying spot price
    K     : strike price
    T     : time to expiry in years
    r     : risk-free rate (annualized, continuous)
    sigma : implied volatility (annualized)
    phi   : +1 for call, -1 for put
"""

import math
from scipy.stats import norm


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

def _d1(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """Standard Black-Scholes d1."""
    return (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))


def _d2(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """Standard Black-Scholes d2 = d1 - sigma*sqrt(T)."""
    return (math.log(S / K) + (r - 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))


# ---------------------------------------------------------------------------
# Price
# ---------------------------------------------------------------------------

def price(S: float, K: float, T: float, r: float, sigma: float, phi: int = 1) -> float:
    """
    Binary cash-or-nothing option price.

    V = e^(-r*T) * N(phi * d2)
    """
    d2 = _d2(S, K, T, r, sigma)
    return math.exp(-r * T) * norm.cdf(phi * d2)


# ---------------------------------------------------------------------------
# Greeks
# ---------------------------------------------------------------------------

def delta(S: float, K: float, T: float, r: float, sigma: float, phi: int = 1) -> float:
    """
    Delta: dV/dS

    Delta = [phi * e^(-r*T)] / [S * sigma * sqrt(T)] * n(d2)
    """
    d2 = _d2(S, K, T, r, sigma)
    return (phi * math.exp(-r * T)) / (S * sigma * math.sqrt(T)) * norm.pdf(d2)


def gamma(S: float, K: float, T: float, r: float, sigma: float, phi: int = 1) -> float:
    """
    Gamma: d²V/dS²

    Gamma = -[phi * e^(-r*T)] / [S² * sigma² * T] * n(d2) * d1

    Note: gamma changes sign at ATM (d1 = 0). Positive for OTM calls,
    negative for ITM calls.
    """
    d1 = _d1(S, K, T, r, sigma)
    d2 = _d2(S, K, T, r, sigma)
    return -(phi * math.exp(-r * T)) / (S**2 * sigma**2 * T) * norm.pdf(d2) * d1


def vega(S: float, K: float, T: float, r: float, sigma: float, phi: int = 1) -> float:
    """
    Vega: dV/d(sigma)

    Vega = -[phi * e^(-r*T)] / sigma * d1 * n(d2)

    Note: vega is negative for ITM calls (d1 > 0), positive for OTM calls.
    This is opposite to vanilla options — binary options lose value when vol
    rises and the contract is already ITM, because higher vol increases the
    chance of moving back OTM.
    """
    d1 = _d1(S, K, T, r, sigma)
    d2 = _d2(S, K, T, r, sigma)
    return -(phi * math.exp(-r * T)) / sigma * d1 * norm.pdf(d2)


def theta(S: float, K: float, T: float, r: float, sigma: float, phi: int = 1) -> float:
    """
    Theta: dV/dt (value change per unit time passing, expressed per year).

    Theta = e^(-r*T) * { phi * n(d2) * [ln(S/K) - (r - sigma²/2)*T] / (2*T*sigma*sqrt(T))
                        + r * N(phi * d2) }

    Divide by 365 to get daily theta.

    Note: theta can be positive for deep ITM contracts — unlike vanilla options,
    a binary call that is deep ITM benefits from time decay because there is
    less time for the underlying to fall back below the strike.
    """
    d2 = _d2(S, K, T, r, sigma)
    log_moneyness = math.log(S / K)

    term1 = (
        phi
        * norm.pdf(d2)
        * (log_moneyness - (r - 0.5 * sigma**2) * T)
        / (2 * T * sigma * math.sqrt(T))
    )
    term2 = r * norm.cdf(phi * d2)

    return math.exp(-r * T) * (term1 + term2)


def rho(S: float, K: float, T: float, r: float, sigma: float, phi: int = 1) -> float:
    """
    Rho: dV/dr

    Rho = e^(-r*T) * [ phi * sqrt(T) / sigma * n(d2) - T * N(phi * d2) ]
    """
    d2 = _d2(S, K, T, r, sigma)
    term1 = phi * math.sqrt(T) / sigma * norm.pdf(d2)
    term2 = T * norm.cdf(phi * d2)
    return math.exp(-r * T) * (term1 - term2)


# ---------------------------------------------------------------------------
# Convenience: all Greeks at once
# ---------------------------------------------------------------------------

def all_greeks(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    phi: int = 1,
) -> dict:
    """
    Return price and all Greeks as a dictionary.

    Parameters
    ----------
    S     : spot price
    K     : strike
    T     : time to expiry (years)
    r     : risk-free rate (annualized)
    sigma : implied volatility (annualized)
    phi   : +1 for call, -1 for put

    Returns
    -------
    dict with keys: price, delta, gamma, vega, theta, theta_daily, rho
    """
    d1_val = _d1(S, K, T, r, sigma)
    d2_val = _d2(S, K, T, r, sigma)

    disc = math.exp(-r * T)
    sqrtT = math.sqrt(T)
    nd2 = norm.pdf(d2_val)
    Nd2 = norm.cdf(phi * d2_val)

    # Price
    v = disc * Nd2

    # Delta
    dlt = (phi * disc) / (S * sigma * sqrtT) * nd2

    # Gamma
    gmm = -(phi * disc) / (S**2 * sigma**2 * T) * nd2 * d1_val

    # Vega
    vg = -(phi * disc) / sigma * d1_val * nd2

    # Theta
    log_moneyness = math.log(S / K)
    term1 = phi * nd2 * (log_moneyness - (r - 0.5 * sigma**2) * T) / (2 * T * sigma * sqrtT)
    term2 = r * Nd2
    th = disc * (term1 + term2)

    # Rho
    rh = disc * (phi * sqrtT / sigma * nd2 - T * Nd2)

    return {
        "price":        v,
        "delta":        dlt,
        "gamma":        gmm,
        "vega":         vg,
        "theta":        th,          # per year
        "theta_daily":  th / 365,    # per calendar day
        "rho":          rh,
        "d1":           d1_val,
        "d2":           d2_val,
    }


# ---------------------------------------------------------------------------
# Quick sanity check
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Example: BTC spot $85,000, strike $80,000, 30 days to expiry,
    # r=5%, sigma=60% annualised (typical crypto vol)
    params = dict(S=85_000, K=80_000, T=30 / 365, r=0.05, sigma=0.60, phi=1)

    g = all_greeks(**params)

    print("Binary cash-or-nothing CALL")
    print(f"  Spot={params['S']:,}  Strike={params['K']:,}  T={params['T']:.4f}yr  "
          f"r={params['r']:.0%}  sigma={params['sigma']:.0%}")
    print()
    print(f"  Price        : {g['price']:.6f}  (model prob = {g['price'] * 100:.2f}%)")
    print(f"  Delta        : {g['delta']:.6f}")
    print(f"  Gamma        : {g['gamma']:.6f}")
    print(f"  Vega         : {g['vega']:.6f}")
    print(f"  Theta/yr     : {g['theta']:.6f}")
    print(f"  Theta/day    : {g['theta_daily']:.6f}")
    print(f"  Rho          : {g['rho']:.6f}")
    print(f"  d1           : {g['d1']:.6f}")
    print(f"  d2           : {g['d2']:.6f}")
