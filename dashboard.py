"""
PolyGreeks — Streamlit testing dashboard.

Lets you exercise every layer of the pipeline interactively:
  - Raw Polymarket market fetch + parser
  - Deribit spot price + vol surface
  - Binary Black-Scholes pricer + Greeks
  - Full contract analysis (spread, hedge)

Run:
  uv run streamlit run dashboard.py
"""

import math
from datetime import date, timedelta

import streamlit as st

import polymarket
import deribit
import greeks as greeks_mod

# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="PolyGreeks — Dev Dashboard",
    page_icon="📊",
    layout="wide",
)

st.title("PolyGreeks — Dev Dashboard")
st.caption("Testing interface for the pricing pipeline. Not for trading.")

RISK_FREE_RATE = 0.05

# ---------------------------------------------------------------------------
# Sidebar — global controls
# ---------------------------------------------------------------------------
st.sidebar.header("Controls")
market_limit = st.sidebar.slider("Markets to fetch", 10, 500, 100, 10)
min_spread   = st.sidebar.slider("Min |spread| filter (pp)", 0, 30, 0) / 100
currency_filter = st.sidebar.selectbox("Currency", ["All", "BTC", "ETH"])

st.sidebar.divider()
st.sidebar.subheader("Manual pricing")
manual_S     = st.sidebar.number_input("Spot (S)", value=67000.0, step=100.0)
manual_K     = st.sidebar.number_input("Strike (K)", value=80000.0, step=1000.0)
manual_T     = st.sidebar.number_input("Days to expiry", value=90, step=1)
manual_sigma = st.sidebar.slider("σ (implied vol %)", 10, 150, 60) / 100
manual_phi   = st.sidebar.radio("Direction", ["Call (+1)", "Put (-1)"])
phi          = 1 if "Call" in manual_phi else -1
manual_pos   = st.sidebar.number_input("Position size (shares)", value=1000, step=100)

# ---------------------------------------------------------------------------
# Tabs
# ---------------------------------------------------------------------------
tabs = st.tabs([
    "📋 Live Markets",
    "📡 Deribit Vol Surface",
    "🧮 Manual Pricer",
    "🔬 Contract Deep-Dive",
])

# ============================================================
# Tab 1 — Live Markets
# ============================================================
with tabs[0]:
    st.subheader("Live Polymarket crypto markets")

    if st.button("Fetch markets", key="fetch_markets"):
        with st.spinner("Fetching from Polymarket + Deribit…"):
            contracts = polymarket.get_crypto_markets(limit=market_limit)

            rows = []
            progress = st.progress(0)
            for i, c in enumerate(contracts):
                progress.progress((i + 1) / max(len(contracts), 1))
                if currency_filter != "All" and c.currency != currency_filter:
                    continue
                try:
                    spot  = deribit.get_index_price(c.currency)
                    T     = max((c.resolution_date - date.today()).days / 365, 1e-6)
                    sigma, _ = deribit.get_interpolated_vol(
                        c.currency, c.strike, c.resolution_date
                    )
                    g = greeks_mod.all_greeks(
                        S=spot, K=c.strike, T=T,
                        r=RISK_FREE_RATE, sigma=sigma, phi=1 if c.direction == "above" else -1,
                    )
                    spread = c.p_market - g["price"]
                    if abs(spread) < min_spread:
                        continue
                    rows.append({
                        "Question":    c.question[:60],
                        "Currency":    c.currency,
                        "Strike":      f"${c.strike:,.0f}",
                        "Direction":   c.direction,
                        "Spot":        f"${spot:,.0f}",
                        "σ":           f"{sigma:.0%}",
                        "p_PM":        f"{c.p_market:.2%}",
                        "p_BS":        f"{g['price']:.2%}",
                        "Spread":      f"{spread:+.2%}",
                        "Δ":           f"{g['delta']:.5f}",
                        "Γ":           f"{g['gamma']:.5f}",
                        "Vega":        f"{g['vega']:.4f}",
                        "θ/day":       f"{g['theta_daily']:.5f}",
                        "Expiry":      c.resolution_date.isoformat(),
                        "Volume":      f"${c.volume:,.0f}",
                        "p_source":    c.p_source,
                    })
                except Exception as e:
                    rows.append({
                        "Question":  c.question[:60],
                        "Currency":  c.currency,
                        "Strike":    f"${c.strike:,.0f}",
                        "Direction": c.direction,
                        "Spot": "—", "σ": "—", "p_PM": f"{c.p_market:.2%}",
                        "p_BS": f"ERROR: {e}", "Spread": "—",
                        "Δ": "—", "Γ": "—", "Vega": "—", "θ/day": "—",
                        "Expiry": c.resolution_date.isoformat(),
                        "Volume": f"${c.volume:,.0f}", "p_source": c.p_source,
                    })
            progress.empty()

        if rows:
            st.success(f"{len(rows)} contracts displayed")
            st.dataframe(rows, use_container_width=True)
        else:
            st.warning("No contracts matched filters.")
    else:
        st.info("Click **Fetch markets** to load live data.")

# ============================================================
# Tab 2 — Deribit Vol Surface
# ============================================================
with tabs[1]:
    st.subheader("Deribit implied vol surface")

    col1, col2 = st.columns(2)
    with col1:
        vol_currency = st.selectbox("Currency", ["BTC", "ETH"], key="vol_ccy")
    with col2:
        vol_strike = st.number_input("Strike to interpolate", value=80000, step=1000)

    vol_target = st.date_input(
        "Target expiry date",
        value=date.today() + timedelta(days=90),
    )

    if st.button("Fetch vol surface", key="fetch_vol"):
        with st.spinner("Fetching from Deribit…"):
            try:
                spot = deribit.get_index_price(vol_currency)
                st.metric(f"{vol_currency} spot", f"${spot:,.2f}")

                sigma, debug = deribit.get_interpolated_vol(
                    vol_currency, vol_strike, vol_target
                )

                st.metric("Interpolated σ", f"{sigma:.2%}")
                st.subheader("Vol surface debug")
                st.json(debug)

                # Show all available expiries
                instruments = deribit.get_instruments(vol_currency)
                expiries = sorted(set(
                    deribit._expiry_date(i["expiration_timestamp"]).isoformat()
                    for i in instruments
                ))
                st.subheader(f"Available expiries ({len(expiries)})")
                st.write(expiries)

            except Exception as e:
                st.error(f"Error: {e}")

# ============================================================
# Tab 3 — Manual Pricer
# ============================================================
with tabs[2]:
    st.subheader("Binary cash-or-nothing pricer")
    st.caption("Uses sidebar inputs. Useful for sanity-checking the Greeks formulas.")

    T_years = max(manual_T / 365, 1e-6)
    g = greeks_mod.all_greeks(
        S=manual_S, K=manual_K, T=T_years,
        r=RISK_FREE_RATE, sigma=manual_sigma, phi=phi,
    )

    moneyness = manual_S / manual_K
    st.caption(f"Moneyness S/K = {moneyness:.4f} · d1 = {g['d1']:.4f} · d2 = {g['d2']:.4f}")

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Price (p_BS)",   f"{g['price']:.4f}",        f"{g['price']:.2%}")
    c2.metric("Delta",          f"{g['delta']:.6f}")
    c3.metric("Gamma",          f"{g['gamma']:.6f}")
    c4.metric("Vega",           f"{g['vega']:.4f}")
    c5.metric("Theta / day",    f"{g['theta_daily']:.6f}")

    st.divider()
    st.subheader(f"Position: {manual_pos:,} shares")

    p1, p2, p3, p4, p5 = st.columns(5)
    p1.metric("Position value",        f"${g['price'] * manual_pos:,.2f}")
    p2.metric("Position delta",        f"{g['delta'] * manual_pos:.4f}")
    p3.metric("Position gamma",        f"{g['gamma'] * manual_pos:.6f}")
    p4.metric("Position vega",         f"{g['vega'] * manual_pos:.4f}")
    p5.metric("Position theta / day",  f"{g['theta_daily'] * manual_pos:.4f}")

    st.divider()
    st.subheader("Sensitivity sweep — delta vs spot")

    spots = [manual_S * (0.7 + i * 0.02) for i in range(31)]
    sweep = [
        {
            "Spot":  round(s, 0),
            "p_BS":  round(float(greeks_mod.price(s, manual_K, T_years, RISK_FREE_RATE, manual_sigma, phi)), 4),
            "Delta": round(float(greeks_mod.delta(s, manual_K, T_years, RISK_FREE_RATE, manual_sigma, phi)), 6),
            "Gamma": round(float(greeks_mod.gamma(s, manual_K, T_years, RISK_FREE_RATE, manual_sigma, phi)), 6),
        }
        for s in spots
    ]
    import pandas as pd
    df = pd.DataFrame(sweep).set_index("Spot")
    st.line_chart(df[["p_BS", "Delta"]])
    st.caption("p_BS and Delta vs spot price (±30% range)")

    with st.expander("Full sweep table"):
        st.dataframe(df, use_container_width=True)

# ============================================================
# Tab 4 — Contract Deep-Dive
# ============================================================
with tabs[3]:
    st.subheader("Contract deep-dive")
    st.caption("Fetch and analyse a single contract by searching for it.")

    search_query = st.text_input("Search query (e.g. 'BTC 80000', 'ETH above')", value="BTC")
    dive_pos = st.number_input("Position size", value=1000, step=100, key="dive_pos")

    if st.button("Search & analyse", key="dive_search"):
        with st.spinner("Searching Polymarket…"):
            results = polymarket.search_markets(search_query, limit=10)

        if not results:
            st.warning("No contracts found.")
        else:
            st.success(f"Found {len(results)} contracts. Showing first.")
            c = results[0]

            st.subheader(c.question)
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Currency",    c.currency)
            m2.metric("Strike",      f"${c.strike:,.0f}")
            m3.metric("Direction",   c.direction)
            m4.metric("Expiry",      c.resolution_date.isoformat())

            m5, m6, m7, m8 = st.columns(4)
            m5.metric("p_PM",        f"{c.p_market:.2%}", help=c.p_source)
            m6.metric("Volume",      f"${c.volume:,.0f}")
            m7.metric("Liquidity",   f"${c.liquidity:,.0f}")
            m8.metric("Token ID",    c.yes_token_id[:12] + "…" if c.yes_token_id else "—")

            with st.spinner("Pricing via Deribit…"):
                try:
                    spot = deribit.get_index_price(c.currency)
                    T    = max((c.resolution_date - date.today()).days / 365, 1e-6)
                    sigma, vol_debug = deribit.get_interpolated_vol(
                        c.currency, c.strike, c.resolution_date
                    )
                    g = greeks_mod.all_greeks(
                        S=spot, K=c.strike, T=T,
                        r=RISK_FREE_RATE, sigma=sigma,
                        phi=1 if c.direction == "above" else -1,
                    )
                    spread = c.p_market - g["price"]

                    st.divider()
                    st.subheader("Model output")
                    r1, r2, r3, r4 = st.columns(4)
                    r1.metric("Spot",    f"${spot:,.2f}")
                    r2.metric("σ",       f"{sigma:.2%}")
                    r3.metric("p_BS",    f"{g['price']:.2%}")
                    r4.metric("Spread",  f"{spread:+.2%}",
                               delta_color="off" if abs(spread) < 0.05 else "normal")

                    st.divider()
                    st.subheader(f"Greeks — {dive_pos:,} share position")
                    g1, g2, g3, g4, g5 = st.columns(5)
                    g1.metric("Delta",       f"{g['delta'] * dive_pos:.5f}")
                    g2.metric("Gamma",       f"{g['gamma'] * dive_pos:.5f}")
                    g3.metric("Vega",        f"{g['vega'] * dive_pos:.4f}")
                    g4.metric("Theta/day",   f"{g['theta_daily'] * dive_pos:.5f}")
                    g5.metric("Position $",  f"${g['price'] * dive_pos:,.2f}")

                    with st.expander("Vol surface debug"):
                        st.json(vol_debug)

                    with st.expander("Raw Greeks (per share)"):
                        st.json({k: round(float(v), 8) for k, v in g.items()})

                except Exception as e:
                    st.error(f"Pricing failed: {e}")
                    st.exception(e)
