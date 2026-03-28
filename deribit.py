"""
Deribit implied volatility surface fetcher.

Fetches option instruments and mark IVs from Deribit's public REST API,
then interpolates to a target strike and expiry using variance-linear
interpolation across time (as specified in the PolyGreeks pricing model).

No API key required — all endpoints used are public.
"""

import math
import time
import threading
import requests
from datetime import date, datetime, timezone

BASE_URL = "https://www.deribit.com/api/v2/public"

# Reuse a single session for connection pooling
_session = requests.Session()

# ---------------------------------------------------------------------------
# Simple TTL cache — avoids re-fetching instruments/smiles on every contract
# ---------------------------------------------------------------------------

_cache: dict = {}
_cache_lock = threading.Lock()

def _cached(key: str, ttl: float, fn):
    """Return cached value if fresh, else call fn(), cache and return result."""
    with _cache_lock:
        entry = _cache.get(key)
        if entry and (time.monotonic() - entry["ts"]) < ttl:
            return entry["val"]
    val = fn()
    with _cache_lock:
        _cache[key] = {"val": val, "ts": time.monotonic()}
    return val


# ---------------------------------------------------------------------------
# Raw API helpers
# ---------------------------------------------------------------------------

def _get(endpoint: str, params: dict) -> dict:
    """GET a Deribit public endpoint, return the result field."""
    resp = _session.get(f"{BASE_URL}/{endpoint}", params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"Deribit API error: {data['error']}")
    return data["result"]


def get_index_price(currency: str) -> float:
    """
    Current spot price for BTC or ETH in USD.

    Parameters
    ----------
    currency : "BTC" or "ETH"
    """
    key = f"index_{currency.upper()}"
    return _cached(key, ttl=30, fn=lambda: _get(
        "get_index_price", {"index_name": f"{currency.lower()}_usd"}
    )["index_price"])


def get_instruments(currency: str) -> list[dict]:
    """
    All non-expired option instruments for a currency.
    Cached for 60 s — shared across all contracts of the same currency.
    """
    key = f"instruments_{currency.upper()}"
    return _cached(key, ttl=60, fn=lambda: _get("get_instruments", {
        "currency": currency.upper(),
        "kind": "option",
        "expired": "false",
    }))


def get_mark_iv(instrument_name: str) -> float | None:
    """
    Mark implied volatility for a single instrument as a decimal (e.g. 0.60).
    Returns None if the instrument has no valid mark IV (illiquid / no quotes).

    Deribit returns IV as a percentage; this function converts to decimal.
    """
    try:
        result = _get("get_order_book", {
            "instrument_name": instrument_name,
            "depth": 1,
        })
        mark_iv = result.get("mark_iv")
        if mark_iv is None or mark_iv <= 0:
            return None
        return mark_iv / 100
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Vol surface construction
# ---------------------------------------------------------------------------

def _expiry_date(ts_ms: int) -> date:
    """Convert a Deribit millisecond timestamp to a UTC date."""
    return datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).date()


def get_expiry_smile(instruments: list[dict], expiry_ts_ms: int) -> dict[float, float]:
    """
    Fetch mark IVs for all call strikes at a given expiry.
    Cached for 60 s — multiple contracts sharing the same expiry pay the
    per-strike order book cost only once.

    Uses calls only for consistency (put-call parity means IVs should match,
    but calls tend to have better liquidity at higher strikes).

    Returns
    -------
    {strike: iv_decimal}  — only strikes with a valid mark IV are included
    """
    key = f"smile_{expiry_ts_ms}"
    cached = _cache.get(key)
    if cached and (time.monotonic() - cached["ts"]) < 60:
        return cached["val"]

    candidates = [
        i for i in instruments
        if i["expiration_timestamp"] == expiry_ts_ms
        and i["option_type"] == "call"
    ]

    smile: dict[float, float] = {}
    for inst in candidates:
        iv = get_mark_iv(inst["instrument_name"])
        if iv is not None:
            smile[inst["strike"]] = iv

    with _cache_lock:
        _cache[key] = {"val": smile, "ts": time.monotonic()}
    return smile


def _interpolate_strike(smile: dict[float, float], K: float) -> float | None:
    """
    Linear interpolation across strikes to get IV at strike K.
    Clamps to the nearest boundary strike if K is outside the available range.
    """
    if not smile:
        return None

    strikes = sorted(smile)

    if K <= strikes[0]:
        return smile[strikes[0]]
    if K >= strikes[-1]:
        return smile[strikes[-1]]

    for lo, hi in zip(strikes, strikes[1:]):
        if lo <= K <= hi:
            w = (K - lo) / (hi - lo)
            return smile[lo] + w * (smile[hi] - smile[lo])

    return None


# ---------------------------------------------------------------------------
# Main interpolation function
# ---------------------------------------------------------------------------

def get_interpolated_vol(
    currency: str,
    K: float,
    target_date: date,
) -> tuple[float, dict]:
    """
    Interpolate implied volatility from Deribit's surface to a given strike
    and expiry date, using variance-linear interpolation across time.

    Variance-linear interpolation:
        sigma_interp = sqrt( (w_lo * sigma_lo² * T_lo  +  w_hi * sigma_hi² * T_hi) / T_target )
    where w_lo, w_hi are the time-proportional weights between bracketing expiries.

    Parameters
    ----------
    currency    : "BTC" or "ETH"
    K           : strike price (e.g. 80_000)
    target_date : Polymarket resolution date

    Returns
    -------
    sigma       : annualised implied volatility as a decimal
    debug       : dict with interpolation details (expiries used, weights, etc.)
    """
    instruments = get_instruments(currency)

    # Collect unique expiry timestamps, sorted ascending
    all_expiry_ts = sorted(set(i["expiration_timestamp"] for i in instruments))

    # Map each to its UTC date for easy comparison
    expiry_by_date = {_expiry_date(ts): ts for ts in all_expiry_ts}
    expiry_dates = sorted(expiry_by_date)

    # Find the two expiry dates that bracket target_date
    lower_date = None
    upper_date = None
    for d in expiry_dates:
        if d <= target_date:
            lower_date = d
        elif upper_date is None:
            upper_date = d
            break

    # Edge cases: target outside the available range → clamp to nearest expiry
    if lower_date is None:
        lower_date = upper_date
        upper_date = None
    if upper_date is None:
        upper_date = lower_date
        lower_date = None

    now_ts_ms = datetime.now(timezone.utc).timestamp() * 1000
    target_ts_ms = datetime(
        target_date.year, target_date.month, target_date.day,
        8, 0, 0, tzinfo=timezone.utc  # Deribit options expire at 08:00 UTC
    ).timestamp() * 1000

    def years_from_now(ts_ms: float) -> float:
        return max((ts_ms - now_ts_ms) / (1000 * 365.25 * 24 * 3600), 1e-6)

    debug: dict = {}

    if lower_date is None or upper_date is None:
        # Only one expiry available — use it directly, no time interpolation
        single_date = upper_date or lower_date
        single_ts = expiry_by_date[single_date]
        smile = get_expiry_smile(instruments, single_ts)
        sigma = _interpolate_strike(smile, K)
        if sigma is None:
            raise ValueError(f"No valid IV found for {currency} near strike {K}")

        debug["method"] = "single_expiry_fallback"
        debug["expiry"] = single_date.isoformat()
        debug["strikes_available"] = len(smile)

    else:
        lo_ts = expiry_by_date[lower_date]
        hi_ts = expiry_by_date[upper_date]

        smile_lo = get_expiry_smile(instruments, lo_ts)
        smile_hi = get_expiry_smile(instruments, hi_ts)

        iv_lo = _interpolate_strike(smile_lo, K)
        iv_hi = _interpolate_strike(smile_hi, K)

        if iv_lo is None or iv_hi is None:
            raise ValueError(
                f"Could not get IV for both bracketing expiries at strike {K:,}. "
                f"lo={lower_date} ({len(smile_lo)} strikes), "
                f"hi={upper_date} ({len(smile_hi)} strikes)"
            )

        T_lo = years_from_now(lo_ts)
        T_hi = years_from_now(hi_ts)
        T_target = years_from_now(target_ts_ms)

        # Variance-linear interpolation
        w = (T_target - T_lo) / (T_hi - T_lo)
        w = max(0.0, min(1.0, w))  # clamp to [0, 1]

        total_variance = (1 - w) * iv_lo**2 * T_lo + w * iv_hi**2 * T_hi
        sigma = math.sqrt(total_variance / T_target)

        debug["method"] = "variance_linear_interpolation"
        debug["expiry_lo"] = lower_date.isoformat()
        debug["expiry_hi"] = upper_date.isoformat()
        debug["iv_lo"] = round(iv_lo, 4)
        debug["iv_hi"] = round(iv_hi, 4)
        debug["T_lo_years"] = round(T_lo, 4)
        debug["T_hi_years"] = round(T_hi, 4)
        debug["T_target_years"] = round(T_target, 4)
        debug["weight_toward_hi"] = round(w, 4)

    debug["sigma"] = round(sigma, 4)
    debug["strike"] = K
    debug["currency"] = currency
    return sigma, debug


# ---------------------------------------------------------------------------
# Quick test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    currency = "BTC"
    K = 80_000
    target = date(2026, 6, 27)

    spot = get_index_price(currency)
    print(f"{currency} spot: ${spot:,.0f}")

    print(f"\nFetching interpolated vol for strike={K:,}, expiry={target} ...")
    sigma, debug = get_interpolated_vol(currency, K, target)

    print(f"\nResult:")
    for k, v in debug.items():
        print(f"  {k}: {v}")
