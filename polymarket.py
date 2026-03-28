"""
Polymarket contract fetcher.

Fetches active crypto price-threshold markets from the Gamma API and parses
them into structured contracts that can be fed into the PolyGreeks pricing model.

Endpoint: https://gamma-api.polymarket.com/markets
No API key required.
"""

import re
import requests
from dataclasses import dataclass
from datetime import date, datetime, timezone

GAMMA_URL = "https://gamma-api.polymarket.com"

_session = requests.Session()


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class Contract:
    """A parsed Polymarket price-threshold contract."""
    id: str
    slug: str
    question: str
    currency: str           # "BTC" or "ETH"
    strike: float           # numeric price threshold e.g. 80000.0
    direction: str          # "above" or "below"
    resolution_date: date
    p_market: float         # Yes probability from outcomePrices, 0–1
    volume: float           # total USD volume
    liquidity: float        # current liquidity


# ---------------------------------------------------------------------------
# Raw API
# ---------------------------------------------------------------------------

def _get(path: str, params: dict) -> list[dict] | dict:
    resp = _session.get(f"{GAMMA_URL}{path}", params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

# Matches dollar amounts like: $80,000  $80k  $80K  $1.5m  $1.5M
# Also matches bare numbers like: 1,965  80000  (used without $ sign in some questions)
# The suffix group uses a negative lookahead (?!\w) to avoid matching letters that are
# part of a following word (e.g. "M" in "March" must not be treated as "million").
_STRIKE_RE = re.compile(
    r"\$\s*([\d,]+(?:\.\d+)?)\s*([kKmM](?!\w))?"   # with dollar sign; optional k/m suffix
    r"|(?<![.\d])([\d]{1,3}(?:,\d{3})+(?:\.\d+)?)\b",  # bare comma-formatted number e.g. 1,965
    re.IGNORECASE,
)

# Keywords that indicate direction
_ABOVE_WORDS = re.compile(r"\b(above|over|exceed|higher than|more than|reach|hit)\b", re.I)
_BELOW_WORDS = re.compile(r"\b(below|under|lower than|less than|drop|fall|dip)\b", re.I)

# Map display names and tickers to canonical currency codes
_CURRENCY_PATTERNS = [
    (re.compile(r"\bBITCOIN\b|\bBTC\b", re.I), "BTC"),
    (re.compile(r"\bETHEREUM\b|\bETH\b", re.I), "ETH"),
]


def _parse_strike(text: str) -> float | None:
    """
    Extract the first price strike from market question text.
    Handles: $80,000  $80k  $80K  $1.5m  and bare  1,965  80,000
    """
    m = _STRIKE_RE.search(text)
    if not m:
        return None
    if m.group(1) is not None:
        # Matched dollar-sign form
        raw = m.group(1)
        numeric = float(raw.replace(",", ""))
        # Only apply k/M multiplier for shorthand numbers (e.g. "$80k", "$1.5m").
        # If the number already uses comma-grouping (e.g. "$54,000"), it is fully
        # expanded — a trailing suffix letter would be part of surrounding text,
        # not a multiplier.
        suffix = (m.group(2) or "").lower() if "," not in raw else ""
        if suffix == "k":
            numeric *= 1_000
        elif suffix == "m":
            numeric *= 1_000_000
    else:
        # Matched bare comma-formatted number
        numeric = float(m.group(3).replace(",", ""))
    return numeric


def _parse_currency(text: str) -> str | None:
    """Return 'BTC' or 'ETH' if found in text (whole-word match), else None."""
    for pattern, currency in _CURRENCY_PATTERNS:
        if pattern.search(text):
            return currency
    return None


def _parse_direction(text: str) -> str:
    """Return 'above' if price-above language found, else 'below'."""
    if _ABOVE_WORDS.search(text):
        return "above"
    if _BELOW_WORDS.search(text):
        return "below"
    # Default: most crypto threshold markets are upside calls
    return "above"


def _parse_date(market: dict) -> date | None:
    """Parse resolution date from endDateIso or endDate fields."""
    raw = market.get("endDateIso") or market.get("endDate")
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])  # trim time component if present
    except ValueError:
        return None


def _parse_probability(market: dict) -> float | None:
    """
    Extract the Yes probability from outcomePrices.
    Polymarket stores outcomes as ["Yes", "No"] with matching outcomePrices.
    """
    outcomes = market.get("outcomes")
    prices = market.get("outcomePrices")
    if not outcomes or not prices:
        return None
    try:
        outcomes_list = outcomes if isinstance(outcomes, list) else __import__("json").loads(outcomes)
        prices_list = prices if isinstance(prices, list) else __import__("json").loads(prices)
        for i, outcome in enumerate(outcomes_list):
            if str(outcome).strip().lower() == "yes":
                return float(prices_list[i])
    except Exception:
        return None
    return None


def _to_contract(market: dict) -> Contract | None:
    """
    Attempt to parse a raw Gamma API market dict into a Contract.
    Returns None if any required field cannot be parsed.
    """
    question = market.get("question", "")

    # Skip range markets ("between $X and $Y") — ambiguous strike
    if len(_STRIKE_RE.findall(question)) > 1:
        return None

    currency = _parse_currency(question)
    strike = _parse_strike(question)
    p_market = _parse_probability(market)
    resolution_date = _parse_date(market)

    if not all([currency, strike, p_market is not None, resolution_date]):
        return None

    # Filter out contracts already past their resolution date
    if resolution_date < date.today():
        return None

    return Contract(
        id=market.get("id", ""),
        slug=market.get("slug", ""),
        question=question,
        currency=currency,
        strike=strike,
        direction=_parse_direction(question),
        resolution_date=resolution_date,
        p_market=p_market,
        volume=float(market.get("volumeNum") or market.get("volume") or 0),
        liquidity=float(market.get("liquidityNum") or market.get("liquidity") or 0),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_crypto_markets(limit: int = 500) -> list[Contract]:
    """
    Fetch active BTC/ETH price-threshold markets, ranked by volume descending.

    Fetches a broad set of markets and filters down to those with a parseable
    currency (BTC/ETH), numeric strike, and resolution date.

    Parameters
    ----------
    limit : number of raw markets to fetch before filtering (default 500)
    """
    raw = _get("/markets", {
        "active": "true",
        "closed": "false",
        "limit": limit,
        "order": "volume",
        "ascending": "false",
    })

    contracts = []
    for m in raw:
        c = _to_contract(m)
        if c is not None:
            contracts.append(c)

    return contracts


def get_market_by_id(market_id: str) -> Contract | None:
    """
    Fetch and parse a single market by its Gamma API ID.
    Returns None if the market cannot be found or parsed.
    """
    raw = _get("/markets", {"id": market_id})
    if not raw:
        return None
    markets = raw if isinstance(raw, list) else [raw]
    return _to_contract(markets[0])


def search_markets(query: str, limit: int = 20) -> list[Contract]:
    """
    Search for markets by keyword (e.g. "BTC 80000", "ETH above").
    Returns parsed contracts sorted by volume.
    """
    raw = _get("/markets", {
        "active": "true",
        "closed": "false",
        "q": query,
        "limit": limit,
        "order": "volume",
        "ascending": "false",
    })

    contracts = []
    for m in raw:
        c = _to_contract(m)
        if c is not None:
            contracts.append(c)

    return contracts


# ---------------------------------------------------------------------------
# Quick test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Fetching active crypto markets from Polymarket...\n")
    contracts = get_crypto_markets(limit=50)

    if not contracts:
        print("No parseable crypto price-threshold contracts found.")
    else:
        print(f"Found {len(contracts)} contracts:\n")
        print(f"{'Question':<60} {'Curr':<5} {'Strike':>10} {'Dir':<6} {'p_PM':>6} {'Expiry':<12} {'Volume':>12}")
        print("-" * 115)
        for c in contracts:
            print(
                f"{c.question[:58]:<60} "
                f"{c.currency:<5} "
                f"${c.strike:>9,.0f} "
                f"{c.direction:<6} "
                f"{c.p_market:>5.1%} "
                f"{c.resolution_date.isoformat():<12} "
                f"${c.volume:>11,.0f}"
            )
