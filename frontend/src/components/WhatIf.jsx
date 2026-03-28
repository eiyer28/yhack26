import { useState, useMemo } from "react";
import { Sliders, Bookmark, RotateCcw, X, ChevronUp, ChevronDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Binary Black-Scholes math (mirrors greeks.py)
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

const R = 0.05;

function binaryGreeks(S, K, T, sigma, phi) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return null;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (R + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const disc = Math.exp(-R * T);
  const price  = disc * normCDF(phi * d2);
  const delta  = phi * disc * normPDF(d2) / (S * sigma * sqrtT);
  const gamma  = -phi * disc * normPDF(d2) * d1 / (S * S * sigma * sigma * T);
  const vega   = -phi * disc * normPDF(d2) * d1 / sigma;
  const theta  = (phi * disc * normPDF(d2) * (d1 / (2 * T) - R / (sigma * sqrtT))
                  + R * price) / -365;
  return { price, delta, gamma, vega: vega / 100, theta_daily: theta, d1, d2 };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function moneyness(S, K, phi) {
  const ratio = Math.abs(S - K) / K;
  if (ratio < 0.005) return { label: "ATM", color: "#f59e0b" };
  const itm = phi === 1 ? S > K : S < K;
  return itm
    ? { label: "ITM", color: "var(--green)" }
    : { label: "OTM", color: "var(--red)" };
}

function fmt(v, decimals = 4) {
  return Math.abs(v) < 0.001 ? v.toExponential(2) : v.toFixed(decimals);
}

// ---------------------------------------------------------------------------
// Metric definitions
// ---------------------------------------------------------------------------

const METRICS = [
  { key: "price",       full: "p_BS (model prob)", short: "p_BS",   dec: 4 },
  { key: "delta",       full: "Delta (Δ)",          short: "Δ",      dec: 6 },
  { key: "gamma",       full: "Gamma (Γ)",          short: "Γ",      dec: 6 },
  { key: "theta_daily", full: "Theta/day",          short: "Θ/day",  dec: 5 },
  { key: "vega",        full: "Vega/1% vol",        short: "ν/1%σ",  dec: 5 },
  { key: "d1",          full: "d1",                 short: "d1",     dec: 4 },
  { key: "d2",          full: "d2",                 short: "d2",     dec: 4 },
];

function StatRow({ metric, baseline, current }) {
  const bVal = baseline[metric.key];
  const cVal = current[metric.key];
  const diff = cVal - bVal;
  const diffColor = diff > 0 ? "var(--green)" : diff < 0 ? "var(--red)" : "var(--text2)";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) 80px 80px 66px",
        gap: 4,
        fontSize: 12,
        padding: "5px 0",
        borderBottom: "1px solid var(--border)",
        fontFamily: "var(--mono)",
        alignItems: "center",
      }}
    >
      <span
        title={metric.full}
        style={{
          color: "var(--text2)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {metric.full}
      </span>
      <span style={{ textAlign: "right" }}>{fmt(bVal, metric.dec)}</span>
      <span style={{ textAlign: "right", color: "var(--accent)", fontWeight: 600 }}>
        {fmt(cVal, metric.dec)}
      </span>
      <span style={{ textAlign: "right", color: diffColor }}>
        {diff > 0 ? "+" : ""}{fmt(diff, metric.dec)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline editable number input
// ---------------------------------------------------------------------------

function InlineNum({ value, onChange, min, max, step = 1, prefix = "", suffix = "", width = 90 }) {
  function increment() {
    const v = value + step;
    if (max == null || v <= max) onChange(v);
  }
  function decrement() {
    const v = value - step;
    if (min == null || v >= min) onChange(v);
  }
  const btnStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    border: "none",
    padding: "0 3px",
    color: "var(--text2)",
    cursor: "pointer",
    flex: 1,
    lineHeight: 1,
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      {prefix && <span style={{ color: "var(--text2)", fontSize: 12 }}>{prefix}</span>}
      <span
        style={{
          display: "inline-flex",
          alignItems: "stretch",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 5,
          overflow: "hidden",
          height: 24,
        }}
      >
        <input
          type="number"
          className="inline-num"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!isNaN(v) && (min == null || v >= min) && (max == null || v <= max)) onChange(v);
          }}
          style={{
            width,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text)",
            fontFamily: "var(--mono)",
            fontSize: 12,
            padding: "0 6px",
            textAlign: "right",
          }}
        />
        <span
          style={{
            display: "flex",
            flexDirection: "column",
            borderLeft: "1px solid var(--border)",
            width: 18,
          }}
        >
          <button onClick={increment} style={{ ...btnStyle, borderBottom: "1px solid var(--border)" }}>
            <ChevronUp size={9} strokeWidth={2.5} />
          </button>
          <button onClick={decrement} style={btnStyle}>
            <ChevronDown size={9} strokeWidth={2.5} />
          </button>
        </span>
      </span>
      {suffix && <span style={{ color: "var(--text2)", fontSize: 12 }}>{suffix}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function WhatIf({ contract, spotPrices }) {
  const K0      = contract.strike;
  const phi     = contract.direction === "above" ? 1 : -1;
  const sigma0  = contract.sigma ?? 0.8;
  const T0days  = Math.max(
    Math.round((new Date(contract.resolution_date) - new Date()) / (1000 * 86400)),
    1
  );
  const spot0   = spotPrices?.[contract.currency] ?? K0;

  // Editable contract parameters
  const [kOverride, setKOverride] = useState(K0);
  const [tDays, setTDays]         = useState(T0days);

  // Scenario sliders
  const [spot, setSpot]       = useState(spot0);
  const [spotStr, setSpotStr] = useState(String(Math.round(spot0)));
  const [sigma, setSigma]     = useState(sigma0);

  // Scenario history (up to 5)
  const [savedScenarios, setSavedScenarios] = useState([]);

  // Derived
  const K       = kOverride;
  const T       = Math.max(tDays / 365, 1 / 365);
  const spotMin = Math.round(K * 0.5);
  const spotMax = Math.round(K * 1.5);
  const spotStep = Math.max(1, Math.round((spotMax - spotMin) / 400));

  const mn = moneyness(spot, K, phi);

  const baseline = useMemo(
    () => binaryGreeks(spot0, K, T, sigma0, phi),
    [spot0, K, T, sigma0, phi]
  );
  const current = useMemo(
    () => binaryGreeks(spot, K, T, sigma, phi),
    [spot, K, T, sigma, phi]
  );

  if (!baseline || !current) return null;

  // P&L bar — two-sided, dynamic scale
  const pnlChange = current.price - baseline.price;
  const ppChange  = pnlChange * 100;
  const scale     = Math.max(Math.abs(ppChange) * 1.6, 5); // min ±5pp, dynamic
  const barPct    = Math.min((Math.abs(ppChange) / scale) * 50, 50);
  const barColor  = pnlChange >= 0 ? "var(--green)" : "var(--red)";

  function handleSpotSlider(v) {
    setSpot(v);
    setSpotStr(String(v));
  }

  function handleSpotInput(str) {
    setSpotStr(str);
    const v = Number(str);
    if (!isNaN(v) && v > 0) setSpot(Math.max(spotMin, Math.min(spotMax, v)));
  }

  function reset() {
    setSpot(spot0);
    setSpotStr(String(Math.round(spot0)));
    setSigma(sigma0);
  }

  function setAtm() {
    setSpot(K);
    setSpotStr(String(K));
  }

  function saveScenario() {
    setSavedScenarios((prev) =>
      [
        {
          id: Date.now(),
          spot,
          sigma,
          label: `S=${spot.toLocaleString()} · σ=${(sigma * 100).toFixed(0)}%`,
          ...current,
          mn: { ...mn },
        },
        ...prev,
      ].slice(0, 5)
    );
  }

  function loadScenario(s) {
    setSpot(s.spot);
    setSpotStr(String(s.spot));
    setSigma(s.sigma);
  }

  function removeScenario(id) {
    setSavedScenarios((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Sliders size={16} color="var(--purple)" />
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>What-If Scenario</h3>
      </div>

      {/* Contract parameters */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 20px",
          alignItems: "center",
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "10px 16px",
          marginBottom: 16,
          fontSize: 12,
        }}
      >
        <span style={{ color: "var(--text2)", fontFamily: "var(--mono)" }}>
          Contract params
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--text2)" }}>K:</span>
          <InlineNum
            value={kOverride}
            onChange={setKOverride}
            min={1}
            step={100}
            prefix="$"
            width={100}
          />
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--text2)" }}>T:</span>
          <InlineNum
            value={tDays}
            onChange={setTDays}
            min={1}
            max={730}
            step={1}
            suffix=" days"
            width={62}
          />
        </span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "var(--mono)",
            background: mn.color + "22",
            color: mn.color,
            border: `1px solid ${mn.color}44`,
          }}
        >
          {mn.label}
        </span>
      </div>

      {/* Sliders */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 16,
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "16px 20px",
        }}
      >
        {/* Spot slider */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
              {contract.currency} Spot
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "var(--mono)",
                  background: mn.color + "22",
                  color: mn.color,
                  border: `1px solid ${mn.color}44`,
                  flexShrink: 0,
                }}
              >
                {mn.label}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "stretch",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 5,
                  overflow: "hidden",
                  height: 24,
                }}
              >
                <input
                  type="number"
                  className="inline-num"
                  value={spotStr}
                  onChange={(e) => handleSpotInput(e.target.value)}
                  style={{
                    width: 82,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--accent)",
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "0 6px",
                    textAlign: "right",
                  }}
                />
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    borderLeft: "1px solid var(--border)",
                    width: 18,
                  }}
                >
                  <button
                    onClick={() => handleSpotSlider(Math.min(spotMax, spot + spotStep))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      padding: "0 3px",
                      color: "var(--text2)",
                      cursor: "pointer",
                      flex: 1,
                    }}
                  >
                    <ChevronUp size={9} strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => handleSpotSlider(Math.max(spotMin, spot - spotStep))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "none",
                      border: "none",
                      padding: "0 3px",
                      color: "var(--text2)",
                      cursor: "pointer",
                      flex: 1,
                    }}
                  >
                    <ChevronDown size={9} strokeWidth={2.5} />
                  </button>
                </span>
              </span>
            </div>
          </div>
          <input
            type="range"
            min={spotMin}
            max={spotMax}
            step={spotStep}
            value={Math.max(spotMin, Math.min(spotMax, spot))}
            onChange={(e) => handleSpotSlider(Number(e.target.value))}
            style={{ width: "100%", accentColor: mn.color }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--text2)",
              marginTop: 2,
            }}
          >
            <span>${spotMin.toLocaleString()}</span>
            <span>baseline: ${spot0.toLocaleString()}</span>
            <span>${spotMax.toLocaleString()}</span>
          </div>
        </div>

        {/* Vol slider */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Implied Vol (σ)</label>
            <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--purple)", fontWeight: 600 }}>
              {(sigma * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min={0.10}
            max={2.00}
            step={0.01}
            value={sigma}
            onChange={(e) => setSigma(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--purple)" }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--text2)",
              marginTop: 2,
            }}
          >
            <span>10%</span>
            <span>baseline: {(sigma0 * 100).toFixed(0)}%</span>
            <span>200%</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          onClick={reset}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "5px 12px",
            color: "var(--text2)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <RotateCcw size={11} />
          Reset
        </button>
        <button
          onClick={setAtm}
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "5px 12px",
            color: "var(--text2)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Set spot = strike
        </button>
        <button
          onClick={saveScenario}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: "var(--surface2)",
            border: "1px solid var(--accent)",
            borderRadius: 6,
            padding: "5px 12px",
            color: "var(--accent)",
            fontSize: 12,
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          <Bookmark size={11} />
          Save scenario
        </button>
      </div>

      {/* Results table */}
      <div
        style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) 80px 80px 66px",
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
        {METRICS.map((m) => (
          <StatRow key={m.key} metric={m} baseline={baseline} current={current} />
        ))}
      </div>

      {/* P&L gauge — two-sided, dynamic scale */}
      <div
        style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "14px 20px",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Model P&amp;L impact</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 700, color: barColor }}>
            {pnlChange > 0 ? "+" : ""}{ppChange.toFixed(2)} pp
            <span style={{ fontSize: 11, color: "var(--text2)", marginLeft: 8, fontWeight: 400 }}>
              ({pnlChange > 0 ? "+" : ""}{((pnlChange / baseline.price) * 100).toFixed(1)}%)
            </span>
          </span>
        </div>
        {/* Two-sided bar */}
        <div
          style={{
            position: "relative",
            height: 8,
            background: "var(--border)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {/* Positive half */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              height: "100%",
              width: `${pnlChange >= 0 ? barPct : 0}%`,
              background: "var(--green)",
              transition: "width 0.2s ease",
            }}
          />
          {/* Negative half */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: "50%",
              height: "100%",
              width: `${pnlChange < 0 ? barPct : 0}%`,
              background: "var(--red)",
              transition: "width 0.2s ease",
            }}
          />
          {/* Center marker */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              width: 1,
              height: "100%",
              background: "var(--text2)",
              opacity: 0.5,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: "var(--text2)",
            marginTop: 4,
            fontFamily: "var(--mono)",
          }}
        >
          <span style={{ color: "var(--red)" }}>−{scale.toFixed(1)}pp</span>
          <span>0</span>
          <span style={{ color: "var(--green)" }}>+{scale.toFixed(1)}pp</span>
        </div>
      </div>

      {/* Saved scenario history */}
      {savedScenarios.length > 0 && (
        <div
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "14px 20px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text2)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Saved scenarios
          </div>
          {savedScenarios.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 0",
                borderBottom: i < savedScenarios.length - 1 ? "1px solid var(--border)" : "none",
                fontSize: 12,
                fontFamily: "var(--mono)",
              }}
            >
              <button
                onClick={() => loadScenario(s)}
                style={{
                  flex: 1,
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  color: "var(--text)",
                }}
              >
                <span
                  style={{
                    padding: "1px 6px",
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    background: s.mn.color + "22",
                    color: s.mn.color,
                    border: `1px solid ${s.mn.color}44`,
                    flexShrink: 0,
                  }}
                >
                  {s.mn.label}
                </span>
                <span style={{ color: "var(--text2)" }}>{s.label}</span>
                <span style={{ marginLeft: "auto", color: "var(--accent)" }}>
                  p={s.price.toFixed(4)}
                </span>
                <span style={{ color: "var(--text2)" }}>Δ={s.delta.toFixed(4)}</span>
                <span style={{ color: "var(--purple)" }}>Θ={s.theta_daily.toFixed(5)}</span>
              </button>
              <button
                onClick={() => removeScenario(s.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text2)",
                  padding: 2,
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
