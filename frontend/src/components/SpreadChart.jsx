import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const fmt = (v) => `${(v * 100).toFixed(1)}%`;

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const pm = payload.find((p) => p.dataKey === "p_market");
  const bs = payload.find((p) => p.dataKey === "p_model");
  const spread = pm && bs ? pm.value - bs.value : null;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 12,
        fontFamily: "var(--mono)",
      }}
    >
      <div style={{ color: "var(--text2)", marginBottom: 6 }}>{label}</div>
      {pm && (
        <div style={{ color: "var(--accent)" }}>
          p_PM: {fmt(pm.value)}
        </div>
      )}
      {bs && (
        <div style={{ color: "var(--purple)" }}>
          p_BS: {fmt(bs.value)}
        </div>
      )}
      {spread !== null && (
        <div
          style={{
            color: Math.abs(spread) > 0.08 ? "var(--red)" : "var(--text2)",
            marginTop: 4,
            borderTop: "1px solid var(--border)",
            paddingTop: 4,
          }}
        >
          spread: {spread > 0 ? "+" : ""}
          {fmt(spread)}
        </div>
      )}
    </div>
  );
}

export default function SpreadChart({ data }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>
          Historical Spread: p_PM vs p_BS
        </h3>
        <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
          <span style={{ color: "var(--accent)" }}>— p_PM (Polymarket)</span>
          <span style={{ color: "var(--purple)" }}>— p_BS (Model)</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--text2)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={4}
          />
          <YAxis
            tickFormatter={fmt}
            tick={{ fill: "var(--text2)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={[0, 1]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="p_market"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            name="p_PM"
          />
          <Line
            type="monotone"
            dataKey="p_model"
            stroke="var(--purple)"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 3"
            name="p_BS"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
