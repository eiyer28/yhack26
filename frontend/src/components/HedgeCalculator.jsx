import { Shield, AlertTriangle } from "lucide-react";

function GreekRow({ label, value, highlight }) {
  const isZero = Math.abs(value) < 0.0001;
  const color = isZero
    ? "var(--green)"
    : highlight
    ? "var(--yellow)"
    : "var(--text)";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: "1px solid var(--border)",
        fontSize: 13,
      }}
    >
      <span style={{ color: "var(--text2)" }}>{label}</span>
      <span style={{ fontFamily: "var(--mono)", color, fontWeight: 600 }}>
        {value > 0 ? "+" : ""}
        {Math.abs(value) < 0.001 ? value.toExponential(2) : value.toFixed(4)}
      </span>
    </div>
  );
}

export default function HedgeCalculator({ hedge, contract }) {
  if (!hedge) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Shield size={16} color="var(--accent)" />
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>Hedge Calculator</h3>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {/* Suggested hedge */}
        <div
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "16px 20px",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Deribit Hedge
          </div>

          <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent)", marginBottom: 6 }}>
            {hedge.deribit_instrument}
          </div>

          <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text2)" }}>Size</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 600 }}>
                {hedge.deribit_size > 0 ? "+" : ""}{hedge.deribit_size} contracts
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text2)" }}>Price</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 600 }}>
                ${hedge.deribit_price.toFixed(3)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text2)" }}>Cost</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 600, color: "var(--red)" }}>
                ${hedge.hedge_cost_usd.toFixed(0)}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            {hedge.note}
          </div>
        </div>

        {/* Combined portfolio greeks */}
        <div
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "16px 20px",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Combined Portfolio
          </div>

          <GreekRow label="Δ Delta" value={hedge.combined_delta} highlight={hedge.hedge_type === "delta"} />
          <GreekRow label="ν Vega" value={hedge.combined_vega} highlight={hedge.hedge_type === "vega"} />
          <GreekRow label="Θ Theta (daily)" value={hedge.combined_theta_daily} />
          <GreekRow label="Γ Gamma" value={hedge.residual_gamma} />

          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "flex-start",
              gap: 6,
              background: "#fbbf2411",
              border: "1px solid #fbbf2440",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 11,
              color: "var(--yellow)",
            }}
          >
            <AlertTriangle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
            Continuous hedging assumed. Transaction costs and oracle risk not modeled.
          </div>
        </div>
      </div>
    </div>
  );
}
