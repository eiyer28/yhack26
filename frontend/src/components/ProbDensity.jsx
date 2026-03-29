import { useState, useMemo } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function erf(x) {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t) * Math.exp(-x*x);
  return s * y;
}
function normCDF(x)  { return 0.5 * (1 + erf(x / Math.sqrt(2))); }
function normPDF(x)  { return Math.exp(-0.5*x*x) / Math.sqrt(2 * Math.PI); }

const R = 0.05;

function lognormalPDF(x, S, sigma, T) {
  if (x <= 0 || sigma <= 0 || T <= 0) return 0;
  const sqrtT = Math.sqrt(T);
  const z = (Math.log(x / S) - (R - 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  return normPDF(z) / (x * sigma * sqrtT);
}

function d2val(S, K, sigma, T) {
  return (Math.log(S / K) + (R - 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
}

// ---------------------------------------------------------------------------
// Build chart data
// ---------------------------------------------------------------------------

const N_POINTS  = 350;
const FAN_TIMES = [0.25, 0.5, 0.75]; // fractions of T for the fan layers

function buildData(spot, K, sigma, T) {
  const xMin = spot * 0.15;
  const xMax = spot * 2.6;
  const step  = (xMax - xMin) / (N_POINTS - 1);

  // Collect raw prices and ensure K and spot are included for clean split
  const prices = new Set();
  for (let i = 0; i < N_POINTS; i++) prices.add(xMin + i * step);
  prices.add(K);
  prices.add(spot);

  const sorted = [...prices].sort((a, b) => a - b);

  return sorted.map((price) => {
    const d = lognormalPDF(price, spot, sigma, T);
    const point = { price };

    // Main density split at strike (for shading)
    point.above = price >= K ? d : null;
    point.below = price <= K ? d : null;

    // At the exact strike boundary, both sides get the density value so the
    // two areas meet without a gap
    if (price === K) { point.above = d; point.below = d; }

    // Fan layers (lighter, at earlier time horizons)
    FAN_TIMES.forEach((f, i) => {
      point[`fan${i}`] = lognormalPDF(price, spot, sigma, T * f);
    });

    return point;
  });
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({ active, payload, K, direction }) {
  if (!active || !payload?.length) return null;
  const price = payload[0]?.payload?.price;
  if (price == null) return null;
  const side = price >= K
    ? (direction === "above" ? "✓ YES territory" : "✗ NO territory")
    : (direction === "above" ? "✗ NO territory" : "✓ YES territory");
  return (
    <div style={{
      background: "var(--surface2)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "8px 12px", fontSize: 12, fontFamily: "var(--mono)",
    }}>
      <div style={{ color: "var(--text2)" }}>BTC at resolution: ${Math.round(price).toLocaleString()}</div>
      <div style={{ color: "var(--text2)", marginTop: 2 }}>{side}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const FAN_COLORS = ["#4f8ef722", "#4f8ef733", "#4f8ef744"];

export default function ProbDensity({ contract, spotPrices }) {
  const K      = contract.strike;
  const sigma0 = contract.sigma ?? 0.8;
  const T      = Math.max(
    (new Date(contract.resolution_date) - new Date()) / (1000 * 86400 * 365), 1 / 365
  );
  const spot0  = spotPrices?.[contract.currency] ?? K;

  const [spot, setSpot] = useState(spot0);

  const spotMin = Math.round(spot0 * 0.5);
  const spotMax = Math.round(spot0 * 1.8);

  const data = useMemo(() => buildData(spot, K, sigma0, T), [spot, K, sigma0, T]);

  // Probabilities
  const d2 = d2val(spot, K, sigma0, T);
  const pAbove = normCDF(d2);
  const pBelow = 1 - pAbove;
  const pYes   = contract.direction === "above" ? pAbove : pBelow;
  const pNo    = 1 - pYes;

  const daysLeft = Math.round(T * 365);

  const aboveColor = contract.direction === "above" ? "var(--green)" : "var(--red)";
  const belowColor = contract.direction === "above" ? "var(--red)"  : "var(--green)";

  const yMax = useMemo(() => {
    const peak = Math.max(...data.map(d => lognormalPDF(d.price, spot, sigma0, T)));
    return peak * 1.15;
  }, [data, spot, sigma0, T]);

  return (
    <div>
      {/* Header + probability pills */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
            Probability Density at Resolution
          </div>
          <div style={{ fontSize: 12, color: "var(--text2)" }}>
            Lognormal distribution of {contract.currency} price in {daysLeft} days · σ = {(sigma0 * 100).toFixed(0)}%
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: `P(YES) = p_BS`, value: pYes, color: "var(--green)" },
            { label: `P(NO)`,         value: pNo,  color: "var(--red)"   },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "8px 14px", textAlign: "center",
            }}>
              <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 3 }}>{label}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 800, color }}>
                {(value * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Spot slider */}
      <div style={{
        background: "var(--surface2)", border: "1px solid var(--border)",
        borderRadius: 8, padding: "12px 16px", marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
          <label style={{ fontWeight: 600 }}>{contract.currency} Spot Price</label>
          <span style={{ fontFamily: "var(--mono)", color: "var(--accent)", fontWeight: 700 }}>
            ${spot.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min={spotMin}
          max={spotMax}
          step={Math.round((spotMax - spotMin) / 300)}
          value={spot}
          onChange={(e) => setSpot(Number(e.target.value))}
          style={{ width: "100%", accentColor: "var(--accent)" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text2)", marginTop: 3 }}>
          <span>${spotMin.toLocaleString()}</span>
          <span>K = ${K.toLocaleString()}</span>
          <span>${spotMax.toLocaleString()}</span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="price"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 10, fill: "var(--text2)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            scale="linear"
          />
          <YAxis hide domain={[0, yMax]} />
          <Tooltip content={<CustomTooltip K={K} direction={contract.direction} />} />

          {/* Fan layers — lighter distributions at T*0.25, T*0.5, T*0.75 */}
          {FAN_TIMES.map((_, i) => (
            <Line
              key={`fan${i}`}
              type="monotone"
              dataKey={`fan${i}`}
              stroke={FAN_COLORS[i]}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
              legendType="none"
            />
          ))}

          {/* Below-strike shading */}
          <Area
            type="monotone"
            dataKey="below"
            stroke="none"
            fill={belowColor}
            fillOpacity={0.25}
            isAnimationActive={false}
            connectNulls={false}
          />

          {/* Above-strike shading */}
          <Area
            type="monotone"
            dataKey="above"
            stroke="none"
            fill={aboveColor}
            fillOpacity={0.25}
            isAnimationActive={false}
            connectNulls={false}
          />

          {/* Main density curve on top */}
          <Line
            type="monotone"
            dataKey="above"
            stroke={aboveColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="below"
            stroke={belowColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />

          {/* Strike line */}
          <ReferenceLine
            x={K}
            stroke="var(--text2)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            label={{ value: `K = $${K.toLocaleString()}`, position: "insideTopRight", fontSize: 10, fill: "var(--text2)" }}
          />

          {/* Current spot */}
          <ReferenceLine
            x={spot}
            stroke="var(--accent)"
            strokeWidth={1}
            strokeDasharray="2 4"
            label={{ value: "S", position: "insideTopLeft", fontSize: 10, fill: "var(--accent)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: "flex", gap: 20, marginTop: 10, fontSize: 11, color: "var(--text2)" }}>
        <span>
          <span style={{ color: aboveColor }}>■</span>{" "}
          Above K → {contract.direction === "above" ? "YES" : "NO"} pays out ({(pAbove * 100).toFixed(1)}%)
        </span>
        <span>
          <span style={{ color: belowColor }}>■</span>{" "}
          Below K → {contract.direction === "above" ? "NO" : "YES"} pays out ({(pBelow * 100).toFixed(1)}%)
        </span>
        <span style={{ color: "#4f8ef755" }}>— Fan: distribution at T×0.25, T×0.5, T×0.75</span>
      </div>
    </div>
  );
}
