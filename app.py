"""
PolyGreeks — CLI dashboard.

Fetches active Polymarket crypto contracts, prices each as a binary
cash-or-nothing option using Deribit implied vol, computes Greeks, and
ranks by spread magnitude (|p_PM - p_BS|).

Usage:
    python app.py              # top 20 contracts by spread
    python app.py --limit 50   # fetch more raw markets before filtering
    python app.py --min-spread 0.05   # only show spread >= 5 pp
"""

import argparse
import sys
from datetime import date, datetime, timezone

import polymarket
import deribit
import greeks as greeks_mod

RISK_FREE_RATE = 0.05  # 5% annualised


# ---------------------------------------------------------------------------
# Core pipeline
# ---------------------------------------------------------------------------

def analyse_contract(contract: polymarket.Contract) -> dict | None:
    """
    Run the full pipeline for a single contract.
    Returns a result dict, or None if data cannot be fetched.
    """
    try:
        spot = deribit.get_index_price(contract.currency)
    except Exception as e:
        return None

    T = max((contract.resolution_date - date.today()).days / 365, 1e-6)
    phi = 1 if contract.direction == "above" else -1

    try:
        sigma, vol_debug = deribit.get_interpolated_vol(
            contract.currency, contract.strike, contract.resolution_date
        )
    except Exception as e:
        return None

    g = greeks_mod.all_greeks(
        S=spot,
        K=contract.strike,
        T=T,
        r=RISK_FREE_RATE,
        sigma=sigma,
        phi=phi,
    )

    p_bs = g["price"]
    spread = contract.p_market - p_bs

    return {
        "contract":  contract,
        "spot":      spot,
        "sigma":     sigma,
        "T":         T,
        "phi":       phi,
        "p_bs":      p_bs,
        "spread":    spread,
        "greeks":    g,
        "vol_debug": vol_debug,
    }


def run_dashboard(limit: int = 200, min_spread: float = 0.0, top_n: int = 20):
    print(f"Fetching Polymarket crypto markets (limit={limit})...")
    contracts = polymarket.get_crypto_markets(limit=limit)
    print(f"  {len(contracts)} parseable contracts found.\n")

    if not contracts:
        print("No contracts to analyse.")
        return

    print("Pricing contracts via Deribit vol surface", end="", flush=True)
    results = []
    for c in contracts:
        r = analyse_contract(c)
        print(".", end="", flush=True)
        if r is not None:
            results.append(r)
    print(f"  {len(results)}/{len(contracts)} priced successfully.\n")

    # Rank by absolute spread descending
    results.sort(key=lambda r: abs(r["spread"]), reverse=True)

    if min_spread > 0:
        results = [r for r in results if abs(r["spread"]) >= min_spread]

    results = results[:top_n]

    if not results:
        print("No results after filtering.")
        return

    _print_table(results)


# ---------------------------------------------------------------------------
# Display
# ---------------------------------------------------------------------------

def _print_table(results: list[dict]):
    header = (
        f"{'#':<3} "
        f"{'Question':<52} "
        f"{'Curr':<4} "
        f"{'Strike':>9} "
        f"{'Dir':<5} "
        f"{'Spot':>9} "
        f"{'Vol':>6} "
        f"{'p_PM':>6} "
        f"{'p_BS':>6} "
        f"{'Spread':>7} "
        f"{'Delta':>8} "
        f"{'Gamma':>8} "
        f"{'Vega':>8} "
        f"{'Th/day':>8} "
        f"{'Expiry':<12}"
    )
    print(header)
    print("-" * len(header))

    for i, r in enumerate(results, 1):
        c = r["contract"]
        g = r["greeks"]
        spread_str = f"{r['spread']:+.1%}"
        print(
            f"{i:<3} "
            f"{c.question[:50]:<52} "
            f"{c.currency:<4} "
            f"${c.strike:>8,.0f} "
            f"{c.direction:<5} "
            f"${r['spot']:>8,.0f} "
            f"{r['sigma']:>5.0%} "
            f"{c.p_market:>5.1%} "
            f"{r['p_bs']:>5.1%} "
            f"{spread_str:>7} "
            f"{g['delta']:>8.5f} "
            f"{g['gamma']:>8.5f} "
            f"{g['vega']:>8.5f} "
            f"{g['theta_daily']:>8.5f} "
            f"{c.resolution_date.isoformat():<12}"
        )

    print()
    _print_legend()


def _print_legend():
    print("Legend:")
    print("  p_PM   = Polymarket implied probability (market price)")
    print("  p_BS   = Model probability (binary Black-Scholes, Deribit vol)")
    print("  Spread = p_PM - p_BS  (positive = market richer than model)")
    print("  Vol    = annualised implied vol interpolated from Deribit surface")
    print("  Delta  = dV/dS per $1 move in underlying")
    print("  Gamma  = d(Delta)/dS; sign flips at ATM")
    print("  Vega   = dV/d(vol)  (negative for ITM contracts)")
    print("  Th/day = daily theta (positive = earns time value for deep ITM)")


# ---------------------------------------------------------------------------
# Detail view for a single contract
# ---------------------------------------------------------------------------

def print_detail(result: dict):
    c = result["contract"]
    g = result["greeks"]
    vd = result["vol_debug"]

    print(f"\n{'='*70}")
    print(f"  {c.question}")
    print(f"{'='*70}")
    print(f"  Currency  : {c.currency}    Direction : {c.direction}    phi={result['phi']:+d}")
    print(f"  Strike    : ${c.strike:,.0f}")
    print(f"  Spot      : ${result['spot']:,.2f}")
    print(f"  Expiry    : {c.resolution_date}   T = {result['T']:.4f} yr")
    print(f"  Sigma (σ) : {result['sigma']:.2%}   (source: {vd.get('method','?')})")
    print()
    print(f"  p_PM (market)  = {c.p_market:.4f}  ({c.p_market:.2%})")
    print(f"  p_BS  (model)  = {result['p_bs']:.4f}  ({result['p_bs']:.2%})")
    print(f"  Spread         = {result['spread']:+.4f}  ({result['spread']:+.2%})")
    print()
    print(f"  Greeks (per 1-contract position):")
    print(f"    Delta      = {g['delta']:>10.6f}   per $1 spot move")
    print(f"    Gamma      = {g['gamma']:>10.6f}   per $1 spot move (Δ change)")
    print(f"    Vega       = {g['vega']:>10.6f}   per 1pp vol move")
    print(f"    Theta/day  = {g['theta_daily']:>10.6f}   daily time decay")
    print(f"    Rho        = {g['rho']:>10.6f}   per 1pp rate move")
    print(f"    d1={g['d1']:.4f}  d2={g['d2']:.4f}")

    if vd.get("method") == "variance_linear_interpolation":
        print()
        print(f"  Vol surface:")
        print(f"    Lower expiry : {vd['expiry_lo']}  IV={vd['iv_lo']:.2%}  T={vd['T_lo_years']:.4f}yr")
        print(f"    Upper expiry : {vd['expiry_hi']}  IV={vd['iv_hi']:.2%}  T={vd['T_hi_years']:.4f}yr")
        print(f"    Weight→hi    : {vd['weight_toward_hi']:.4f}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PolyGreeks — binary options Greeks for Polymarket")
    parser.add_argument("--limit",      type=int,   default=200,  help="Raw markets to fetch before filtering (default 200)")
    parser.add_argument("--top",        type=int,   default=20,   help="Rows to display, ranked by |spread| (default 20)")
    parser.add_argument("--min-spread", type=float, default=0.0,  help="Minimum |spread| to include, e.g. 0.05 (default 0)")
    parser.add_argument("--detail",     type=int,   default=None, help="Print full detail for result #N (1-indexed)")
    args = parser.parse_args()

    # Run the dashboard
    print(f"\nPolyGreeks — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n")

    contracts = polymarket.get_crypto_markets(limit=args.limit)
    if not contracts:
        print("No parseable crypto contracts found.")
        sys.exit(0)

    print(f"Found {len(contracts)} parseable contracts. Pricing via Deribit", end="", flush=True)
    results = []
    for c in contracts:
        r = analyse_contract(c)
        print(".", end="", flush=True)
        if r is not None:
            results.append(r)
    print(f"\n{len(results)}/{len(contracts)} priced successfully.\n")

    results.sort(key=lambda r: abs(r["spread"]), reverse=True)

    if args.min_spread > 0:
        results = [r for r in results if abs(r["spread"]) >= args.min_spread]

    top = results[:args.top]

    if not top:
        print("No results after filtering.")
        sys.exit(0)

    _print_table(top)

    if args.detail is not None:
        idx = args.detail - 1
        if 0 <= idx < len(top):
            print_detail(top[idx])
        else:
            print(f"--detail index {args.detail} out of range (1–{len(top)})")
