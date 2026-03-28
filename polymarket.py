"""
Polymarket contract fetcher.

Uses two Polymarket APIs:
  - Gamma API (gamma-api.polymarket.com) — market discovery, metadata, token IDs
  - CLOB API  (clob.polymarket.com)      — live midpoint prices for YES tokens

The CLOB midpoint is more accurate than Gamma's outcomePrices (which are cached
and can lag by several minutes).  We fall back to Gamma's outcomePrices if the
CLOB call fails or the token ID is unavailable.

Authentication:
  Read-only CLOB endpoints are public — no API key required.
  If POLYMARKET_API_KEY / POLYMARKET_SECRET / POLYMARKET_PASSPHRASE are set in
  the environment (via .env), they are forwarded on every request so that rate
  limits on authenticated endpoints apply to your account rather than the shared
  anonymous pool.

  See .env.example for the required variable names.
"""

from __future__ import annotations

import json
import os
import re
import requests
from dataclasses import dataclass
from datetime import date, datetime, timezone

from dotenv import load_dotenv

load_dotenv()

GAMMA_URL = "https://gamma-api.polymarket.com"
CLOB_URL  = "https://clob.polymarket.com"

# ---------------------------------------------------------------------------
# Session setup — attach CLOB auth headers if credentials are present
# ---------------------------------------------------------------------------

_session = requests.Session()

_API_KEY     = os.getenv("POLYMARKET_API_KEY", "")
_SECRET      = os.getenv("POLYMARKET_SECRET", "")
_PASSPHRASE  = os.getenv("POLYMARKET_PASSPHRASE", "")

if _API_KEY:
    _session.headers.update({
        "POLY_API_KEY":    _API_KEY,
        "POLY_PASSPHRASE": _PASSPHRASE,
    })


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class Contract:
    """A parsed Polymarket price-threshold contract."""
    condition_id:    str
    slug:            str
    question:        str
    currency:        str    # "BTC" or "ETH"
    strike:          float  # numeric price threshold e.g. 80000.0
    direction:       str    # "above" or "below"
    resolution_date: date
    p_market:        float  # Yes probability (0–1), sourced from CLOB midpoint
    p_source:        str    # "clob_midpoint" | "gamma_outcome_price"
    yes_token_id:    str    # CLOB token ID for the YES outcome
    volume:          float  # total USD volume
    liquidity:       float  # current liquidity


# ---------------------------------------------------------------------------
# Raw API helpers
# ---------------------------------------------------------------------------

def _gamma_get(path: str, params: dict) -> list[dict] | dict:
    resp = _session.get(f"{GAMMA_URL}{path}", params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _clob_get(path: str, params: dict | None = None) -> dict:
    resp = _session.get(f"{CLOB_URL}{path}", params=params or {}, timeout=10)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# CLOB live pricing
# ---------------------------------------------------------------------------

def get_clob_midpoint(token_id: str) -> float | None:
    """
    Fetch the live midpoint price for a CLOB token (0–1).
    Returns None on any error (illiquid market, network issue, etc.).
    """
    if not token_id:
        return None
    try:
        data = _clob_get("/midpoint", {"token_id": token_id})
        mid = data.get("mid")
        if mid is None:
            return None
        return float(mid)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

# Matches dollar amounts like: $80,000  $80k  $80K  $1.5m  $1.5M
# Also matches bare comma-formatted numbers like: 1,965  80,000
_STRIKE_RE = re.compile(
    r"\$\s*([\d,]+(?:\.\d+)?)\s*([kKmM](?!\w))?"   # dollar-sign form; optional k/m suffix
    r"|(?<![.\d])([\d]{1,3}(?:,\d{3})+(?:\.\d+)?)\b",  # bare comma-formatted number
    re.IGNORECASE,
)

_ABOVE_WORDS = re.compile(r"\b(above|over|exceed|higher than|more than|reach|hit)\b", re.I)
_BELOW_WORDS = re.compile(r"\b(below|under|lower than|less than|drop|drops|fall|falls|dip|dips|decline)\b", re.I)

_CURRENCY_PATTERNS = [
    (re.compile(r"\bBITCOIN\b|\bBTC\b", re.I), "BTC"),
    (re.compile(r"\bETHEREUM\b|\bETH\b", re.I), "ETH"),
]


def _parse_strike(text: str) -> float | None:
    m = _STRIKE_RE.search(text)
    if not m:
        return None
    if m.group(1) is not None:
        raw = m.group(1)
        numeric = float(raw.replace(",", ""))
        # Only apply k/M multiplier for shorthand numbers (e.g. "$80k", "$1.5m").
        # If the number already uses comma-grouping (e.g. "$54,000"), it is fully
        # expanded — a trailing suffix letter is part of surrounding text.
        suffix = (m.group(2) or "").lower() if "," not in raw else ""
        if suffix == "k":
            numeric *= 1_000
        elif suffix == "m":
            numeric *= 1_000_000
    else:
        numeric = float(m.group(3).replace(",", ""))
    return numeric


def _parse_currency(text: str) -> str | None:
    for pattern, currency in _CURRENCY_PATTERNS:
        if pattern.search(text):
            return currency
    return None


def _parse_direction(text: str) -> str:
    if _ABOVE_WORDS.search(text):
        return "above"
    if _BELOW_WORDS.search(text):
        return "below"
    return "above"  # most crypto threshold markets are upside calls


def _parse_date(market: dict) -> date | None:
    raw = (
        market.get("endDateIso")
        or market.get("endDate")
        or market.get("end_date_iso")
    )
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


def _extract_yes_token_id(market: dict) -> str:
    """
    Return the CLOB token ID for the YES outcome.

    Gamma returns token IDs in two ways:
      - clobTokenIds: ["YES_ID", "NO_ID"]  (parallel to the outcomes array)
      - tokens: [{"token_id": ..., "outcome": "Yes"}, ...]  (CLOB-style embedded)
    """
    # Prefer the structured tokens list if present
    tokens = market.get("tokens")
    if tokens:
        if isinstance(tokens, str):
            try:
                tokens = json.loads(tokens)
            except Exception:
                tokens = None
        if tokens:
            for t in tokens:
                if str(t.get("outcome", "")).strip().lower() == "yes":
                    return t.get("token_id", "")

    # Fall back to parallel clobTokenIds + outcomes arrays
    clob_ids = market.get("clobTokenIds")
    if clob_ids:
        if isinstance(clob_ids, str):
            try:
                clob_ids = json.loads(clob_ids)
            except Exception:
                clob_ids = None
        if clob_ids:
            outcomes = market.get("outcomes")
            if isinstance(outcomes, str):
                try:
                    outcomes = json.loads(outcomes)
                except Exception:
                    outcomes = None
            if outcomes:
                for i, outcome in enumerate(outcomes):
                    if str(outcome).strip().lower() == "yes" and i < len(clob_ids):
                        return clob_ids[i]
            # If no outcomes mapping, assume index 0 = YES (Polymarket convention)
            if clob_ids:
                return clob_ids[0]

    return ""


def _parse_probability_gamma(market: dict) -> float | None:
    """Extract the Yes probability from Gamma's outcomePrices (fallback)."""
    outcomes = market.get("outcomes")
    prices   = market.get("outcomePrices")
    if not outcomes or not prices:
        return None
    try:
        outcomes_list = outcomes if isinstance(outcomes, list) else json.loads(outcomes)
        prices_list   = prices   if isinstance(prices,   list) else json.loads(prices)
        for i, outcome in enumerate(outcomes_list):
            if str(outcome).strip().lower() == "yes":
                return float(prices_list[i])
    except Exception:
        return None
    return None


def _to_contract(market: dict) -> Contract | None:
    question = market.get("question", "")

    # Skip range markets ("between $X and $Y") — ambiguous strike
    if len(_STRIKE_RE.findall(question)) > 1:
        return None

    currency        = _parse_currency(question)
    strike          = _parse_strike(question)
    resolution_date = _parse_date(market)

    if not all([currency, strike, resolution_date]):
        return None

    if resolution_date < date.today():
        return None

    yes_token_id = _extract_yes_token_id(market)

    # Try CLOB midpoint first; fall back to Gamma outcomePrices
    p_market = get_clob_midpoint(yes_token_id)
    if p_market is not None:
        p_source = "clob_midpoint"
    else:
        p_market = _parse_probability_gamma(market)
        p_source = "gamma_outcome_price"

    if p_market is None:
        return None

    return Contract(
        condition_id    = market.get("conditionId") or market.get("condition_id", ""),
        slug            = market.get("slug", ""),
        question        = question,
        currency        = currency,
        strike          = strike,
        direction       = _parse_direction(question),
        resolution_date = resolution_date,
        p_market        = p_market,
        p_source        = p_source,
        yes_token_id    = yes_token_id,
        volume          = float(market.get("volumeNum") or market.get("volume") or 0),
        liquidity       = float(market.get("liquidityNum") or market.get("liquidity") or 0),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_crypto_markets(limit: int = 500) -> list[Contract]:
    """
    Fetch active BTC/ETH price-threshold markets, ranked by volume descending.
    Uses Gamma API for discovery + CLOB midpoint for live probability.
    """
    raw = _gamma_get("/markets", {
        "active":    "true",
        "closed":    "false",
        "limit":     limit,
        "order":     "volume",
        "ascending": "false",
    })

    contracts = []
    for m in (raw if isinstance(raw, list) else []):
        c = _to_contract(m)
        if c is not None:
            contracts.append(c)

    return contracts


def get_market_by_slug(slug: str) -> Contract | None:
    """Fetch and parse a single market by its slug."""
    raw = _gamma_get("/markets", {"slug": slug})
    markets = raw if isinstance(raw, list) else [raw]
    if not markets:
        return None
    return _to_contract(markets[0])


def search_markets(query: str, limit: int = 20) -> list[Contract]:
    """Search markets by keyword. Returns parsed contracts sorted by volume."""
    raw = _gamma_get("/markets", {
        "active":    "true",
        "closed":    "false",
        "q":         query,
        "limit":     limit,
        "order":     "volume",
        "ascending": "false",
    })

    contracts = []
    for m in (raw if isinstance(raw, list) else []):
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
        print(f"{'Question':<60} {'Curr':<5} {'Strike':>10} {'Dir':<6} {'p_PM':>6} {'Src':<20} {'Expiry':<12} {'Volume':>12}")
        print("-" * 135)
        for c in contracts:
            print(
                f"{c.question[:58]:<60} "
                f"{c.currency:<5} "
                f"${c.strike:>9,.0f} "
                f"{c.direction:<6} "
                f"{c.p_market:>5.1%} "
                f"{c.p_source:<20} "
                f"{c.resolution_date.isoformat():<12} "
                f"${c.volume:>11,.0f}"
            )
