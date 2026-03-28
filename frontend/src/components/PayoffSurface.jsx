import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// Build a flat list of {prob, days, pnl} for scatter / heatmap display
function buildPoints(surface) {
  return surface.flatMap((row) =>
    row.data.map((d) => ({
      prob: d.prob,
      days: row.days,
      pnl: d.pnl,
    }))
  );
}

function pnlColor(pnl) {
  if (pnl > 0.3) return "#34d399";
  if (pnl > 0) return "#86efac";
  if (pnl > -0.2) return "#fca5a5";
  return "#f87171";
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
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
      <div>Prob at resolution: {(d.prob * 100).toFixed(0)}%</div>
      <div>Days remaining: {d.days}</div>
      <div style={{ color: d.pnl >= 0 ? "var(--green)" : "var(--red)", marginTop: 4 }}>
        P&L per share: {d.pnl > 0 ? "+" : ""}${d.pnl.toFixed(3)}
      </div>
    </div>
  );
}

export default function PayoffSurface({ surface, entryPrice }) {
  const points = buildPoints(surface);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>Payoff Surface</h3>
        <div style={{ color: "var(--text2)", fontSize: 12, marginTop: 2 }}>
          P&L per share · entry @ ${entryPrice?.toFixed(3) ?? "—"} · X = prob at resolution · Y = days remaining
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 11, flexWrap: "wrap" }}>
        {[
          { color: "#34d399", label: "High profit (> +$0.30)" },
          { color: "#86efac", label: "Profit (0 to +$0.30)" },
          { color: "#fca5a5", label: "Small loss (0 to -$0.20)" },
          { color: "#f87171", label: "Loss (< -$0.20)" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text2)" }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            {label}
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="prob"
            name="Probability"
            domain={[0, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fill: "var(--text2)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            type="number"
            dataKey="days"
            name="Days"
            tick={{ fill: "var(--text2)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            label={{ value: "Days", angle: -90, position: "insideLeft", fill: "var(--text2)", fontSize: 11 }}
          />
          <ZAxis range={[120, 120]} />
          <Tooltip content={<CustomTooltip />} />
          <Scatter data={points} shape="square">
            {points.map((p, i) => (
              <Cell key={i} fill={pnlColor(p.pnl)} fillOpacity={0.85} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
