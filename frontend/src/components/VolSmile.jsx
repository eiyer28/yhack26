import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, ReferenceDot,
} from "recharts";

function fmt(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

function CustomTooltip({ active, payload, contractStrike }) {
  if (!active || !payload?.length) return null;
  const { strike, iv_pct } = payload[0].payload;
  const atContract = Math.abs(strike - contractStrike) < 1;
  return (
    <div
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 12,
        fontFamily: "var(--mono)",
      }}
    >
      <div style={{ color: "var(--text2)", marginBottom: 4 }}>Strike: {fmt(strike)}</div>
      <div style={{ color: "var(--accent)", fontWeight: 700 }}>IV: {iv_pct.toFixed(1)}%</div>
      {atContract && (
        <div style={{ color: "var(--purple)", marginTop: 4 }}>← contract strike</div>
      )}
    </div>
  );
}

export default function VolSmile({ marketId, contract }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/markets/${marketId}/vol-smile`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [marketId]);

  if (loading) return (
    <div style={{ padding: 24, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>
      Fetching vol smile from Deribit…
    </div>
  );
  if (error || !data) return (
    <div style={{ padding: 24, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>
      Vol smile unavailable for this expiry.
    </div>
  );

  const { smile, contract_strike, contract_sigma_pct, spot, expiry, currency } = data;

  // Filter to a readable strike range: 40% – 220% of spot
  const visible = smile.filter(d => d.strike >= spot * 0.4 && d.strike <= spot * 2.2);
  if (!visible.length) return null;

  const ivValues  = visible.map(d => d.iv_pct);
  const yMin      = Math.max(0, Math.floor(Math.min(...ivValues) - 5));
  const yMax      = Math.ceil(Math.max(...ivValues) + 5);

  // Does the contract strike appear in the visible range?
  const strikeInRange = contract_strike >= spot * 0.4 && contract_strike <= spot * 2.2;

  // Find IV at contract strike for the reference dot (interpolate if needed)
  let contractIvOnCurve = contract_sigma_pct;
  for (let i = 0; i < visible.length - 1; i++) {
    const lo = visible[i], hi = visible[i + 1];
    if (lo.strike <= contract_strike && contract_strike <= hi.strike) {
      const w = (contract_strike - lo.strike) / (hi.strike - lo.strike);
      contractIvOnCurve = lo.iv_pct + w * (hi.iv_pct - lo.iv_pct);
      break;
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Volatility Smile</div>
          <div style={{ fontSize: 12, color: "var(--text2)" }}>
            {currency} options · expiry {expiry} · calls only
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "var(--text2)", marginBottom: 2 }}>Spot</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{fmt(spot)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "var(--text2)", marginBottom: 2 }}>Model σ (interpolated)</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--purple)" }}>
              {contract_sigma_pct.toFixed(1)}%
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "var(--text2)", marginBottom: 2 }}>Curve σ at strike</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--accent)" }}>
              {contractIvOnCurve.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={visible} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="strike"
            tickFormatter={fmt}
            tick={{ fontSize: 11, fill: "var(--text2)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "var(--text2)" }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<CustomTooltip contractStrike={contract_strike} />} />

          {/* ATM reference */}
          <ReferenceLine
            x={spot}
            stroke="var(--text2)"
            strokeDasharray="4 4"
            label={{ value: "spot", position: "insideTopRight", fontSize: 10, fill: "var(--text2)" }}
          />

          {/* Contract strike */}
          {strikeInRange && (
            <ReferenceLine
              x={contract_strike}
              stroke="var(--purple)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: "K", position: "insideTopLeft", fontSize: 10, fill: "var(--purple)" }}
            />
          )}

          <Line
            type="monotone"
            dataKey="iv_pct"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "var(--accent)" }}
          />

          {/* Highlight where the contract strike sits on the curve */}
          {strikeInRange && (
            <ReferenceDot
              x={contract_strike}
              y={contractIvOnCurve}
              r={6}
              fill="var(--purple)"
              stroke="var(--bg)"
              strokeWidth={2}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 8, lineHeight: 1.6 }}>
        <span style={{ color: "var(--purple)" }}>●</span> Purple dot = where this contract's strike sits on the Deribit smile for the nearest expiry.
        The model σ ({contract_sigma_pct.toFixed(1)}%) is time-interpolated across expiries and may differ from the
        single-expiry curve value ({contractIvOnCurve.toFixed(1)}%).
        {contractIvOnCurve > contract_sigma_pct
          ? " Contract is on the expensive part of the smile relative to the model."
          : " Contract is on the cheap part of the smile relative to the model."}
      </div>
    </div>
  );
}
