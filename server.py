"""
PolyGreeks API server.

Exposes the Python pricing pipeline over HTTP so the React frontend can consume it.

Endpoints:
  GET /api/markets          — ranked list of contracts with Greeks
  GET /api/markets/{id}     — full detail for one contract (condition_id or slug)
  GET /api/spot             — live BTC/ETH spot prices from Deribit

Run:
  uvicorn server:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
from datetime import date
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import polymarket
import deribit
import greeks as greeks_mod

app = FastAPI(title="PolyGreeks API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

RISK_FREE_RATE = 0.05
_executor = ThreadPoolExecutor(max_workers=8)


# ---------------------------------------------------------------------------
# Shared pipeline (same logic as app.py)
# ---------------------------------------------------------------------------

def _analyse(contract: polymarket.Contract) -> dict | None:
    try:
        spot = deribit.get_index_price(contract.currency)
    except Exception:
        return None

    T = max((contract.resolution_date - date.today()).days / 365, 1e-6)
    phi = 1 if contract.direction == "above" else -1

    try:
        sigma, vol_debug = deribit.get_interpolated_vol(
            contract.currency, contract.strike, contract.resolution_date
        )
    except Exception:
        return None

    g = greeks_mod.all_greeks(
        S=spot, K=contract.strike, T=T,
        r=RISK_FREE_RATE, sigma=sigma, phi=phi,
    )

    spread = contract.p_market - g["price"]

    return {
        # Identity
        "id":              contract.condition_id or contract.slug,
        "slug":            contract.slug,
        "question":        contract.question,
        "currency":        contract.currency,
        "strike":          contract.strike,
        "direction":       contract.direction,
        "resolution_date": contract.resolution_date.isoformat(),
        "yes_token_id":    contract.yes_token_id,
        # Probabilities
        "p_market":        round(contract.p_market, 6),
        "p_model":         round(g["price"], 6),
        "p_source":        contract.p_source,
        "spread":          round(spread, 6),
        # Vol
        "sigma":           round(sigma, 6),
        "vol_debug":       vol_debug,
        # Market data
        "volume":          contract.volume,
        "liquidity":       contract.liquidity,
        # Greeks (per 1-contract)
        "greeks": {
            "delta":        round(g["delta"],        8),
            "gamma":        round(g["gamma"],        8),
            "vega":         round(g["vega"],         6),
            "theta":        round(g["theta"],        6),
            "theta_daily":  round(g["theta_daily"],  6),
            "rho":          round(g["rho"],          6),
            "d1":           round(g["d1"],           4),
            "d2":           round(g["d2"],           4),
        },
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/spot")
def get_spot():
    """Live BTC and ETH spot prices from Deribit."""
    result = {}
    for currency in ("BTC", "ETH"):
        try:
            result[currency] = deribit.get_index_price(currency)
        except Exception:
            result[currency] = None
    return result


@app.get("/api/markets")
def get_markets(limit: int = 200, min_spread: float = 0.0):
    """
    Ranked list of BTC/ETH Polymarket contracts with Greeks.
    Sorted by |spread| descending.
    """
    contracts = polymarket.get_crypto_markets(limit=limit)
    if not contracts:
        return []

    loop = asyncio.new_event_loop()

    async def _run_all():
        futures = [
            loop.run_in_executor(_executor, _analyse, c)
            for c in contracts
        ]
        return await asyncio.gather(*futures)

    results = loop.run_until_complete(_run_all())
    loop.close()

    results = [r for r in results if r is not None]
    results.sort(key=lambda r: abs(r["spread"]), reverse=True)

    if min_spread > 0:
        results = [r for r in results if abs(r["spread"]) >= min_spread]

    return results


@app.get("/api/markets/{market_id}")
def get_market(market_id: str):
    """Full detail for a single contract by condition_id or slug."""
    # Try condition_id first, then slug search
    contract = polymarket.get_market_by_condition_id(market_id)
    if contract is None:
        results = polymarket.search_markets(market_id, limit=5)
        contract = next((c for c in results if c.slug == market_id), None)
    if contract is None:
        raise HTTPException(status_code=404, detail=f"Market '{market_id}' not found")

    result = _analyse(contract)
    if result is None:
        raise HTTPException(status_code=502, detail="Could not price contract (Deribit data unavailable)")
    return result
