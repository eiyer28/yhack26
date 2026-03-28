"""
PolyGreeks API server.

Endpoints:
  GET /api/markets                         — ranked list with Greeks
  GET /api/markets/{id}                    — single contract detail
  GET /api/spot                            — live BTC/ETH spot prices
  GET /api/markets/{id}/surface-plot       — payoff surface as standalone HTML
  GET /api/markets/{id}/history            — historical p_PM vs p_BS
  GET /api/markets/{id}/hedge              — hedge calculator

Run:
  uv run uvicorn server:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
import math
import requests as _requests
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone

import plotly.graph_objects as go
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from scipy.stats import norm

import polymarket
import deribit
import greeks as greeks_mod

app = FastAPI(title="PolyGreeks API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://prediction.eashan-iyer.com",
        "https://yhack26-production-8d5a.up.railway.app",
        "https://yhack26-9ebmeuzv5-eashan-iyers-projects.vercel.app",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)

RISK_FREE_RATE = 0.05
_executor = ThreadPoolExecutor(max_workers=8)

CLOB_URL = "https://clob.polymarket.com"


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _T(resolution_date: date) -> float:
    return max((resolution_date - date.today()).days / 365, 1e-6)


def _analyse(contract: polymarket.Contract) -> dict | None:
    try:
        spot = deribit.get_index_price(contract.currency)
    except Exception:
        return None

    T = _T(contract.resolution_date)
    phi = 1 if contract.direction == "above" else -1

    try:
        sigma, vol_debug = deribit.get_interpolated_vol(
            contract.currency, contract.strike, contract.resolution_date
        )
    except Exception:
        return None

    g = greeks_mod.all_greeks(S=spot, K=contract.strike, T=T,
                               r=RISK_FREE_RATE, sigma=sigma, phi=phi)
    spread = contract.p_market - g["price"]

    return {
        "id":              contract.slug,
        "slug":            contract.slug,
        "question":        contract.question,
        "currency":        contract.currency,
        "strike":          contract.strike,
        "direction":       contract.direction,
        "resolution_date": contract.resolution_date.isoformat(),
        "yes_token_id":    contract.yes_token_id,
        "p_market":        round(contract.p_market, 6),
        "p_model":         round(g["price"], 6),
        "p_source":        contract.p_source,
        "spread":          round(spread, 6),
        "sigma":           round(sigma, 6),
        "vol_debug":       vol_debug,
        "volume":          contract.volume,
        "liquidity":       contract.liquidity,
        "greeks": {
            "delta":       round(g["delta"],       8),
            "gamma":       round(g["gamma"],       8),
            "vega":        round(g["vega"],        6),
            "theta":       round(g["theta"],       6),
            "theta_daily": round(g["theta_daily"], 6),
            "rho":         round(g["rho"],         6),
            "d1":          round(g["d1"],          4),
            "d2":          round(g["d2"],          4),
        },
        # Keep these for internal use by other endpoints
        "_spot":  spot,
        "_T":     T,
        "_phi":   phi,
        "_sigma": sigma,
    }


def _resolve_contract(market_id: str):
    """Return (contract, result) or raise 404/502."""
    contract = polymarket.get_market_by_slug(market_id)
    if contract is None:
        raise HTTPException(status_code=404, detail=f"Market '{market_id}' not found")
    result = _analyse(contract)
    if result is None:
        raise HTTPException(status_code=502, detail="Could not price contract (Deribit data unavailable)")
    return contract, result


# ---------------------------------------------------------------------------
# Routes — markets
# ---------------------------------------------------------------------------

@app.get("/api/spot")
def get_spot():
    out = {}
    for currency in ("BTC", "ETH"):
        try:
            out[currency] = deribit.get_index_price(currency)
        except Exception:
            out[currency] = None
    return out


@app.get("/api/markets")
def get_markets(limit: int = 200, min_spread: float = 0.0):
    contracts = polymarket.get_crypto_markets(limit=limit)
    if not contracts:
        return []

    loop = asyncio.new_event_loop()

    async def _run_all():
        futures = [loop.run_in_executor(_executor, _analyse, c) for c in contracts]
        return await asyncio.gather(*futures)

    results = loop.run_until_complete(_run_all())
    loop.close()

    results = [r for r in results if r is not None]
    results.sort(key=lambda r: abs(r["spread"]), reverse=True)
    if min_spread > 0:
        results = [r for r in results if abs(r["spread"]) >= min_spread]

    # Strip internal keys before returning
    for r in results:
        r.pop("_spot", None); r.pop("_T", None)
        r.pop("_phi", None);  r.pop("_sigma", None)
    return results


@app.get("/api/markets/{market_id}")
def get_market(market_id: str):
    contract, result = _resolve_contract(market_id)
    result.pop("_spot", None); result.pop("_T", None)
    result.pop("_phi", None);  result.pop("_sigma", None)
    return result


# ---------------------------------------------------------------------------
# Payoff surface
# ---------------------------------------------------------------------------

_COLORSCALE = [
    [0.00, "#7f1d1d"],
    [0.15, "#ef4444"],
    [0.35, "#fca5a5"],
    [0.48, "#fee2e2"],
    [0.50, "#f1f5f9"],
    [0.52, "#dcfce7"],
    [0.65, "#86efac"],
    [0.85, "#22c55e"],
    [1.00, "#14532d"],
]


@app.get("/api/markets/{market_id}/surface-plot", response_class=HTMLResponse)
def get_surface_plot(market_id: str):
    """
    Payoff surface with spot price on X axis so the digital cliff at K is visible.

    X = spot price (linear, centred on strike, spanning ±3σ√T)
    Y = days remaining (dense near expiry to capture cliff formation)
    Z = P&L per share = binary_price(S, K, T, r, σ) - entry_price

    Extra traces:
      - Semi-transparent Z=0 breakeven plane
      - Vertical line at current spot price
      - Vertical line at strike K (where the cliff lives)
    """
    contract, result = _resolve_contract(market_id)

    sigma = result["_sigma"]
    phi   = result["_phi"]
    K     = contract.strike
    T_now = result["_T"]
    entry = result["p_model"]
    spot  = result["_spot"]

    # ------------------------------------------------------------------
    # Spot grid: centre on K, span ±3σ√T using 60 evenly spaced points.
    # Using the contract's actual T ensures the range is wide enough to
    # show the full transition from P&L ≈ (1-entry) down to P&L ≈ -entry.
    # ------------------------------------------------------------------
    T_ref = max(T_now, 7 / 365)
    half  = K * (math.exp(3 * sigma * math.sqrt(T_ref)) - 1)
    S_min = max(K - half, K * 0.25)
    S_max = K + half
    n_spots = 60
    spot_grid = [S_min + i * (S_max - S_min) / (n_spots - 1) for i in range(n_spots)]

    # ------------------------------------------------------------------
    # Days grid: front-load near expiry so the cliff sharpening is dense.
    # T=1,2,3 capture the near-vertical wall; larger values show the full
    # sigmoid smoothing out.
    # ------------------------------------------------------------------
    # Fixed pedagogical range — always show 1–90 days regardless of T_now
    # so the digital cliff is always visible on the surface.
    days_grid = [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90]

    # ------------------------------------------------------------------
    # Build Z matrix: z[row=day_index][col=spot_index]
    # ------------------------------------------------------------------
    z_pnl: list[list[float]] = []
    for d in days_grid:
        T_s = max(d / 365, 1e-6)
        row = []
        for S in spot_grid:
            try:
                p = float(greeks_mod.price(S, K, T_s, RISK_FREE_RATE, sigma, phi))
            except Exception:
                p = 0.0
            row.append(round(p - entry, 5))
        z_pnl.append(row)

    # Symmetric color range so Z=0 sits exactly at the white midpoint
    max_abs = max(entry, 1.0 - entry, 0.01)

    # Z range for vertical marker lines
    z_lo = -max_abs - 0.05
    z_hi =  max_abs + 0.05

    # Breakeven plane: flat grid at Z=0
    z_zero = [[0.0] * n_spots for _ in days_grid]

    # ------------------------------------------------------------------
    # Build figure
    # ------------------------------------------------------------------
    fig = go.Figure()

    # 1. Main P&L surface
    fig.add_trace(go.Surface(
        name="P&L",
        x=spot_grid,
        y=days_grid,
        z=z_pnl,
        colorscale=_COLORSCALE,
        cauto=False,
        cmin=-max_abs,
        cmax=max_abs,
        contours=dict(
            x=dict(show=True, color="#1e293b", width=1),
            y=dict(show=True, color="#1e293b", width=1),
            z=dict(show=True, usecolormap=True, project=dict(z=True), width=2),
        ),
        lighting=dict(ambient=0.75, diffuse=0.8, roughness=0.4, specular=0.3, fresnel=0.15),
        colorbar=dict(
            title=dict(text="P&L / share", font=dict(color="#94a3b8", size=11)),
            tickformat="+.2f",
            tickfont=dict(color="#94a3b8", size=10),
            len=0.65, thickness=14, x=1.01,
        ),
        hovertemplate="Spot: $%{x:,.0f}<br>Days left: %{y}<br>P&L: %{z:+.4f}<extra></extra>",
    ))

    # 2. Breakeven plane at Z=0 (semi-transparent slate)
    fig.add_trace(go.Surface(
        name="Breakeven (Z=0)",
        x=spot_grid,
        y=days_grid,
        z=z_zero,
        colorscale=[[0, "#334155"], [1, "#334155"]],
        showscale=False,
        opacity=0.18,
        hoverinfo="skip",
        lighting=dict(ambient=1.0),
    ))

    # 3. Vertical line at current spot price (orange — BTC colour)
    fig.add_trace(go.Scatter3d(
        name=f"Spot ${spot:,.0f}",
        x=[spot, spot],
        y=[days_grid[0], days_grid[-1]],
        z=[z_lo, z_hi],
        mode="lines",
        line=dict(color="#f7931a", width=5),
        hovertemplate=f"Current spot: ${spot:,.0f}<extra></extra>",
    ))

    # 4. Vertical line at strike K (red dashed — the cliff location)
    fig.add_trace(go.Scatter3d(
        name=f"Strike ${K:,.0f}",
        x=[K, K],
        y=[days_grid[0], days_grid[-1]],
        z=[z_lo, z_hi],
        mode="lines",
        line=dict(color="#ef4444", width=5, dash="dash"),
        hovertemplate=f"Strike K: ${K:,.0f}<extra></extra>",
    ))

    fig.update_layout(
        scene=dict(
            xaxis=dict(
                title=dict(text=f"{contract.currency} spot price ($)", font=dict(color="#94a3b8", size=11)),
                tickprefix="$",
                tickformat=",",
                tickfont=dict(color="#94a3b8", size=10),
                gridcolor="#1e293b",
                backgroundcolor="#0d1117",
            ),
            yaxis=dict(
                title=dict(text="Days remaining", font=dict(color="#94a3b8", size=11)),
                autorange="reversed",   # near-expiry cliff at front
                tickfont=dict(color="#94a3b8", size=10),
                gridcolor="#1e293b",
                backgroundcolor="#0d1117",
            ),
            zaxis=dict(
                title=dict(text="P&L per share ($)", font=dict(color="#94a3b8", size=11)),
                tickformat="+.2f",
                tickfont=dict(color="#94a3b8", size=10),
                gridcolor="#1e293b",
                zerolinecolor="#64748b",
                zeroline=True,
                backgroundcolor="#0d1117",
                range=[z_lo, z_hi],
            ),
            bgcolor="#0d1117",
            # Camera angle chosen so the cliff (near-expiry front face) is prominent
            camera=dict(
                eye=dict(x=1.8, y=-1.8, z=1.1),
                center=dict(x=0, y=0, z=-0.15),
            ),
            aspectmode="manual",
            aspectratio=dict(x=1.5, y=1.0, z=0.75),
        ),
        legend=dict(
            x=0.01, y=0.99,
            font=dict(color="#94a3b8", size=11),
            bgcolor="rgba(0,0,0,0)",
        ),
        paper_bgcolor="#0d1117",
        plot_bgcolor="#0d1117",
        margin=dict(l=0, r=70, t=10, b=0),
        font=dict(family="ui-monospace, monospace", color="#94a3b8"),
    )

    return fig.to_html(full_html=True, include_plotlyjs="cdn", config={
        "displayModeBar": True,
        "scrollZoom": True,
        "displaylogo": False,
        "modeBarButtonsToRemove": ["toImage", "sendDataToCloud"],
    })


# ---------------------------------------------------------------------------
# Historical spread
# ---------------------------------------------------------------------------

@app.get("/api/markets/{market_id}/history")
def get_history(market_id: str):
    """
    Historical p_PM from CLOB prices-history, alongside p_BS computed with
    current spot/vol but the historical time-to-expiry (constant-sigma model).

    Returns [{date, p_market, p_model}] sorted oldest-first.
    """
    contract, result = _resolve_contract(market_id)

    token_id = contract.yes_token_id
    if not token_id:
        raise HTTPException(status_code=404, detail="No CLOB token ID for this contract")

    try:
        resp = _requests.get(
            f"{CLOB_URL}/prices-history",
            params={"market": token_id, "interval": "max", "fidelity": 100},
            timeout=10,
        )
        resp.raise_for_status()
        raw = resp.json().get("history", [])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"CLOB prices-history error: {e}")

    if not raw:
        return []

    spot  = result["_spot"]
    sigma = result["_sigma"]
    phi   = result["_phi"]

    history = []
    for pt in raw:
        try:
            hist_date = datetime.fromtimestamp(pt["t"], tz=timezone.utc).date()
        except Exception:
            continue

        days_left = (contract.resolution_date - hist_date).days
        T_hist    = max(days_left / 365, 1e-6)

        try:
            p_model = greeks_mod.price(spot, contract.strike, T_hist,
                                       RISK_FREE_RATE, sigma, phi)
        except Exception:
            p_model = None

        history.append({
            "date":     datetime.fromtimestamp(pt["t"], tz=timezone.utc).strftime("%b %d"),
            "p_market": round(float(pt["p"]), 4),
            "p_model":  round(p_model, 4) if p_model is not None else None,
        })

    return history


# ---------------------------------------------------------------------------
# Hedge calculator
# ---------------------------------------------------------------------------

def _vanilla_greeks(S: float, K: float, T: float, r: float, sigma: float, phi: int = 1):
    """Delta and vega of a vanilla Black-Scholes call (phi=1) or put (phi=-1)."""
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    delta = phi * norm.cdf(phi * d1)
    vega  = S * math.sqrt(T) * norm.pdf(d1)            # dV/d(sigma), per 1 contract
    theta = (-(S * norm.pdf(d1) * sigma) / (2 * math.sqrt(T))
             - phi * r * K * math.exp(-r * T) * norm.cdf(phi * d2)) / 365
    gamma = norm.pdf(d1) / (S * sigma * math.sqrt(T))
    return {"delta": delta, "vega": vega, "theta_daily": theta, "gamma": gamma, "d1": d1}


@app.get("/api/markets/{market_id}/hedge")
def get_hedge(
    market_id: str,
    position_size: int = Query(default=1000, ge=1),
    hedge_type: str = Query(default="delta", pattern="^(delta|vega)$"),
):
    """
    Suggest a Deribit vanilla option hedge for a Polymarket position.

    Finds the Deribit instrument closest to the contract's strike and expiry,
    sizes it to neutralize either delta (hedge_type=delta) or vega (hedge_type=vega),
    and returns the combined portfolio Greeks.
    """
    contract, result = _resolve_contract(market_id)

    spot  = result["_spot"]
    sigma = result["_sigma"]
    phi   = result["_phi"]

    poly_delta = result["greeks"]["delta"] * position_size
    poly_vega  = result["greeks"]["vega"]  * position_size
    poly_theta = result["greeks"]["theta_daily"] * position_size
    poly_gamma = result["greeks"]["gamma"] * position_size

    # --- Find nearest Deribit instrument ---
    instruments = deribit.get_instruments(contract.currency)

    # Instrument type selection depends on hedge purpose:
    #   Delta hedge: use OPPOSITE type to the binary so the hedge instrument is near/in-the-money
    #     (same-type would be OTM → near-zero delta → impractically large position size)
    #   Vega hedge: use SAME type (vega is well-behaved for either type; matches direction)
    if hedge_type == "delta":
        inst_type = "put" if contract.direction == "above" else "call"
    else:
        inst_type = "call" if contract.direction == "above" else "put"

    inst_phi = 1 if inst_type == "call" else -1

    candidates = [i for i in instruments if i["option_type"] == inst_type]
    if not candidates:
        raise HTTPException(status_code=404, detail="No Deribit instruments available")

    target_ts_ms = datetime(
        contract.resolution_date.year,
        contract.resolution_date.month,
        contract.resolution_date.day,
        8, 0, 0, tzinfo=timezone.utc,
    ).timestamp() * 1000

    now_ms = datetime.now(timezone.utc).timestamp() * 1000

    def _score(inst):
        days_diff   = abs(inst["expiration_timestamp"] - target_ts_ms) / (86400 * 1000)
        strike_diff = abs(inst["strike"] - contract.strike) / contract.strike
        return days_diff * 0.5 + strike_diff * 100  # prioritise strike proximity

    best = min(candidates, key=_score)

    T_deribit = max((best["expiration_timestamp"] - now_ms) / (1000 * 86400 * 365.25), 1e-6)

    hedge_iv = deribit.get_mark_iv(best["instrument_name"]) or sigma
    vg = _vanilla_greeks(spot, best["strike"], T_deribit, RISK_FREE_RATE, hedge_iv, inst_phi)

    # --- Get Deribit price (in USD) ---
    try:
        ob = deribit._get("get_order_book", {
            "instrument_name": best["instrument_name"], "depth": 1
        })
        deribit_price_usd = ob.get("mark_price", 0) * spot  # mark_price in BTC → USD
    except Exception:
        deribit_price_usd = 0.0

    # --- Size the hedge ---
    if hedge_type == "delta":
        greek_to_neutralise = vg["delta"]
        if abs(greek_to_neutralise) < 1e-10:
            raise HTTPException(status_code=400, detail="Deribit instrument has near-zero delta")
        n = -poly_delta / greek_to_neutralise
        note = (
            f"{'Short' if n < 0 else 'Long'} {abs(round(n, 4))} contracts of "
            f"{best['instrument_name']} to neutralise delta. "
            "Residual vega exposure remains — consider a separate vega hedge."
        )
    else:  # vega
        greek_to_neutralise = vg["vega"]
        if abs(greek_to_neutralise) < 1e-10:
            raise HTTPException(status_code=400, detail="Deribit instrument has near-zero vega")
        n = -poly_vega / greek_to_neutralise
        note = (
            f"{'Short' if n < 0 else 'Long'} {abs(round(n, 4))} contracts of "
            f"{best['instrument_name']} to neutralise vega. "
            "Residual delta exposure remains — consider a separate delta hedge."
        )

    combined_delta       = round(poly_delta + n * vg["delta"],       8)
    combined_vega        = round(poly_vega  + n * vg["vega"],        6)
    combined_theta_daily = round(poly_theta + n * vg["theta_daily"], 6)
    residual_gamma       = round(poly_gamma + n * vg["gamma"],       8)

    return {
        "hedge_type":           hedge_type,
        "deribit_instrument":   best["instrument_name"],
        "deribit_size":         round(n, 4),
        "deribit_price":        round(deribit_price_usd, 4),
        "hedge_cost_usd":       round(abs(n) * deribit_price_usd, 2),
        "combined_delta":       combined_delta,
        "combined_vega":        combined_vega,
        "combined_theta_daily": combined_theta_daily,
        "residual_gamma":       residual_gamma,
        "note":                 note,
    }
