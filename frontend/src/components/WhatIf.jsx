import { useState, useMemo } from "react";
import { Sliders } from "lucide-react";

// ---------------------------------------------------------------------------
// Binary Black-Scholes math in JS (mirrors greeks.py)
// ---------------------------------------------------------------------------

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 =  0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p  = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
  return sign * y;
}

function normCDF(x) { return 0.5 * (1 + erf(x / Math.sqrt(2))); }
function normPDF(x) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }

const R = 0.05; // risk-free rate

function binaryGreeks(S, K, T, sigma, phi) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return null;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (R + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const disc = Math.exp(-R * T);
  const price  = disc * normCDF(phi * d2);
  const delta  = phi * disc * normPDF(d2) / (S * sigma * sqrtT);
  const gamma  = -phi * disc * normPDF(d2) * d1 / (S * S * sigma * sigma * T);
  const vega   = -phi * disc * normPDF(d2) * d1 / sigma;          // dV/dσ
  const theta  = (phi * disc * normPDF(d2) * (d1 / (2 * T) - R / (sigma * sqrtT))
                  + R * price) / -365;
  return { price, delta, gamma, vega: vega / 100, theta_daily: theta, d1, d2 };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function StatRow({ label, baseline, current, unit, decimals = 4 }) {
  const diff = current - baseline;
  const fmtSmall = (v) => (Math.abs(v) < 0.001 ? v.toExponential(2) : v.toFixed(decimals));
  const diffColor = diff > 0 ? "var(--green)" : diff < 0 ? "var(--red)" : "var(--text2)";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 90px 90px 80px",
        gap: 4,
        fontSize: 12,
        padding: "5px 0",
        borderBottom: "1px solid var(--border)",
        fontFamily: "var(--mono)",
        alignItems: "center",
      }}
    >
      <span style={{ color: "var(--text2)", fontFamily: "inherit" }}>{label}</span>
      <span style={{ textAlign: "right" }}>{fmtSmall(baseline)}</span>
      <span style={{ textAlign: "right", color: "var(--accent)", fontWeight: 600 }}>
        {fmtSmall(current)}
      </span>
      <span style={{ textAlign: "right", color: diffColor }}>
        {diff > 0 ? "+" : ""}{fmtSmall(diff)}
      </span>
    </div>
  );
}

export default function WhatIf({ contract, spotPrices }) {
  const K      = contract.strike;
  const phi    = contract.direction === "above" ? 1 : -1;
  const sigma0 = contract.sigma ?? 0.8;
  const T      = Math.max((new Date(contract.resolution_date) - new Date()) / (1000 * 86400 * 365), 1 / 365);
  const spot0  = spotPrices?.[contract.currency] ?? K;

  const [spot, setSpot]   = useState(spot0);
  const [sigma, setSigma] = useState(sigma0);

  const baseline = useMemo(() => binaryGreeks(spot0, K, T, sigma0, phi), [spot0, K, T, sigma0, phi]);
  const current  = useMemo(() => binaryGreeks(spot,  K, T, sigma,  phi), [spot,  K, T, sigma,  phi]);

  if (!baseline || !current) return null;

  const spotMin   = Math.round(K * 0.5);
  const spotMax   = Math.round(K * 1.5);
  const sigmaMin  = 0.10;
  const sigmaMax  = 2.00;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Sliders size={16} color="var(--purple)" />
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>What-If Scenario</h3>
      </div>

      {/* Sliders */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 24,
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "16px 20px",
        }}
      >
        {/* Spot slider */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>{contract.currency} Spot Price</label>
            <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent)" }}>
              ${spot.toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            min={spotMin}
            max={spotMax}
            step={Math.round((spotMax - spotMin) / 200)}
            value={spot}
            onChange={(e) => setSpot(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text2)", marginTop: 2 }}>
            <span>${spotMin.toLocaleString()}</span>
            <span style={{ color: "var(--text2)" }}>
              current: ${spot0.toLocaleString()} · K: ${K.toLocaleString()}
            </span>
            <span>${spotMax.toLocaleString()}</span>
          </div>
        </div>

        {/* Vol slider */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Implied Vol (σ)</label>
            <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--purple)" }}>
              {(sigma * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min={sigmaMin}
            max={sigmaMax}
            step={0.01}
            value={sigma}
            onChange={(e) => setSigma(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--purple)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text2)", marginTop: 2 }}>
            <span>10%</span>
            <span style={{ color: "var(--text2)" }}>current: {(sigma0 * 100).toFixed(0)}%</span>
            <span>200%</span>
          </div>
        </div>
      </div>

      {/* Reset buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => { setSpot(spot0); setSigma(sigma0); }}
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "5px 12px",
            color: "var(--text2)",
            fontSize: 12,
          }}
        >
          Reset to current
        </button>
        <button
          onClick={() => setSpot(K)}
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "5px 12px",
            color: "var(--text2)",
            fontSize: 12,
          }}
        >
          Set spot = strike
        </button>
      </div>

      {/* Results table */}
      <div
        style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "16px 20px",
        }}
      >
        {/* Column headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px 90px 90px 80px",
            gap: 4,
            fontSize: 11,
            color: "var(--text2)",
            paddingBottom: 6,
            borderBottom: "1px solid var(--border)",
            marginBottom: 4,
          }}
        >
          <span>Metric</span>
          <span style={{ textAlign: "right" }}>Baseline</span>
          <span style={{ textAlign: "right", color: "var(--accent)" }}>Scenario</span>
          <span style={{ textAlign: "right" }}>Change</span>
        </div>

        <StatRow label="p_BS (model prob)" baseline={baseline.price}       current={current.price}       decimals={4} />
        <StatRow label="Delta (Δ)"          baseline={baseline.delta}       current={current.delta}       decimals={6} />
        <StatRow label="Gamma (Γ)"          baseline={baseline.gamma}       current={current.gamma}       decimals={6} />
        <StatRow label="Theta/day (Θ)"      baseline={baseline.theta_daily} current={current.theta_daily} decimals={5} />
        <StatRow label="Vega/1% vol (ν)"    baseline={baseline.vega}        current={current.vega}        decimals={5} />
        <StatRow label="d1"                 baseline={baseline.d1}          current={current.d1}          decimals={4} />
        <StatRow label="d2"                 baseline={baseline.d2}          current={current.d2}          decimals={4} />
      </div>

      {/* P&L gauge */}
      {(() => {
        const pnlChange = current.price - baseline.price;
        const pctChange = (pnlChange / baseline.price) * 100;
        const barColor = pnlChange > 0 ? "var(--green)" : "var(--red)";
        const barWidth = Math.min(Math.abs(pctChange), 100);
        return (
          <div
            style={{
              marginTop: 16,
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "14px 20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Model P&amp;L impact</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 700, color: barColor }}>
                {pnlChange > 0 ? "+" : ""}{(pnlChange * 100).toFixed(2)} pp
                <span style={{ fontSize: 11, color: "var(--text2)", marginLeft: 8 }}>
                  ({pnlChange > 0 ? "+" : ""}{pctChange.toFixed(1)}%)
                </span>
              </span>
            </div>
            <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${barWidth}%`,
                  background: barColor,
                  borderRadius: 4,
                  transition: "width 0.2s ease",
                  marginLeft: pnlChange >= 0 ? "50%" : `${50 - barWidth / 2}%`,
                }}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
