// ---------------------------------------------------------------------------
// PLACEHOLDER DATA — replace these with real API calls
// ---------------------------------------------------------------------------
// Shapes match the Python backend exactly:
//   Contract  → polymarket.py  Contract dataclass
//   GreeksResult → greeks.py  all_greeks() return dict
//   VolDebug  → deribit.py  get_interpolated_vol() debug dict
// ---------------------------------------------------------------------------

export const PLACEHOLDER_SPOT = {
  BTC: 85000,
  ETH: 3200,
};

// List of contracts as returned by polymarket.get_crypto_markets()
export const PLACEHOLDER_CONTRACTS = [
  {
    id: "pm-btc-100k-jun27",
    slug: "btc-100000-june-27",
    question: "Will BTC reach $100,000 by June 27?",
    currency: "BTC",
    strike: 100000,
    direction: "above",
    resolution_date: "2026-06-27",
    p_market: 0.34,
    volume: 4_200_000,
    liquidity: 610_000,
    // Computed fields (will come from greeks + deribit)
    p_model: 0.21,
    sigma: 0.62,
  },
  {
    id: "pm-btc-90k-apr30",
    slug: "btc-90000-april-30",
    question: "Will BTC be above $90,000 on April 30?",
    currency: "BTC",
    strike: 90000,
    direction: "above",
    resolution_date: "2026-04-30",
    p_market: 0.41,
    volume: 2_800_000,
    liquidity: 390_000,
    p_model: 0.29,
    sigma: 0.59,
  },
  {
    id: "pm-eth-4k-jun27",
    slug: "eth-4000-june-27",
    question: "Will ETH exceed $4,000 by June 27?",
    currency: "ETH",
    strike: 4000,
    direction: "above",
    resolution_date: "2026-06-27",
    p_market: 0.38,
    volume: 1_900_000,
    liquidity: 270_000,
    p_model: 0.44,
    sigma: 0.71,
  },
  {
    id: "pm-btc-80k-apr30",
    slug: "btc-80000-april-30",
    question: "Will BTC stay above $80,000 through April 30?",
    currency: "BTC",
    strike: 80000,
    direction: "above",
    resolution_date: "2026-04-30",
    p_market: 0.72,
    volume: 1_600_000,
    liquidity: 220_000,
    p_model: 0.78,
    sigma: 0.58,
  },
  {
    id: "pm-eth-3k-apr15",
    slug: "eth-3000-april-15",
    question: "Will ETH be above $3,000 by April 15?",
    currency: "ETH",
    strike: 3000,
    direction: "above",
    resolution_date: "2026-04-15",
    p_market: 0.61,
    volume: 980_000,
    liquidity: 140_000,
    p_model: 0.67,
    sigma: 0.68,
  },
  {
    id: "pm-btc-75k-mar31",
    slug: "btc-75000-march-31",
    question: "Will BTC drop below $75,000 before March 31?",
    currency: "BTC",
    strike: 75000,
    direction: "below",
    resolution_date: "2026-03-31",
    p_market: 0.18,
    volume: 760_000,
    liquidity: 110_000,
    p_model: 0.12,
    sigma: 0.61,
  },
];

// Greeks for a single contract + position, as returned by greeks.all_greeks()
// Position size is in shares (1 share = $1 payout)
export function makePlaceholderGreeks(contract, positionSize = 1000) {
  return {
    // Raw greeks (per share)
    price: contract.p_model,
    delta: 0.000024,
    gamma: -0.0000000031,
    vega: -0.18,
    theta: 0.0012,           // per year
    theta_daily: 0.0012 / 365,
    rho: 0.003,
    d1: 0.42,
    d2: 0.31,
    // Scaled to position
    position_size: positionSize,
    position_delta: 0.000024 * positionSize,
    position_gamma: -0.0000000031 * positionSize,
    position_vega: -0.18 * positionSize,
    position_theta_daily: (0.0012 / 365) * positionSize,
    position_value: contract.p_model * positionSize,
    // Vol source
    sigma: contract.sigma,
    sigma_source: "Deribit variance-linear interpolation",
  };
}

// Historical spread data (p_market vs p_model over time)
export const PLACEHOLDER_SPREAD_HISTORY = Array.from({ length: 30 }, (_, i) => {
  const daysAgo = 29 - i;
  const base = 0.30;
  const drift = daysAgo * 0.003;
  const noise = Math.sin(i * 1.3) * 0.04 + Math.cos(i * 0.7) * 0.02;
  return {
    date: new Date(Date.now() - daysAgo * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    p_market: Math.min(0.95, Math.max(0.05, base + drift + noise)),
    p_model: Math.min(0.95, Math.max(0.05, base + drift + noise * 0.6 - 0.08)),
  };
});

// Payoff surface: probability × days remaining → P&L per share
export function makePlaceholderPayoffSurface() {
  const days = [1, 7, 14, 30, 60, 90];
  const probs = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  return days.map((d) => ({
    days: d,
    data: probs.map((p) => ({
      prob: p,
      // Binary payoff: 1 if p>0.5 else 0, minus entry cost (~p_model)
      pnl: parseFloat(((p >= 0.5 ? 1 : 0) - 0.34).toFixed(3)),
    })),
  }));
}

// Deribit vol surface debug info
export function makePlaceholderVolDebug(contract) {
  return {
    method: "variance_linear_interpolation",
    expiry_lo: "2026-03-28",
    expiry_hi: "2026-06-27",
    iv_lo: 0.58,
    iv_hi: 0.65,
    T_lo_years: 0.001,
    T_hi_years: 0.247,
    T_target_years: 0.247,
    weight_toward_hi: 1.0,
    sigma: contract.sigma,
    strike: contract.strike,
    currency: contract.currency,
  };
}

// Hedge calculator result
export function makePlaceholderHedge(contract, positionSize, hedgeType = "delta") {
  return {
    hedge_type: hedgeType,
    deribit_instrument: `${contract.currency}-27JUN26-${contract.strike}-C`,
    deribit_size: hedgeType === "delta" ? -0.024 : -0.18,
    deribit_price: 0.043,
    combined_delta: 0.000001,
    combined_vega: hedgeType === "vega" ? 0.001 : -0.14,
    combined_theta_daily: -0.0003,
    residual_gamma: -0.0000000031 * positionSize,
    hedge_cost_usd: 43.0,
    note:
      hedgeType === "delta"
        ? "Delta-neutral hedge via short call on Deribit. Residual vega exposure remains."
        : "Vega-neutral hedge via short call on Deribit. Residual delta exposure remains.",
  };
}
