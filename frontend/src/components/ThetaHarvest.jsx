import { TrendingUp, AlertTriangle, Clock } from "lucide-react";

function Row({ label, value, color }) {
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
      <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: color ?? "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}

export default function ThetaHarvest({ data, contract }) {
  if (!data) return null;

  const { is_positive_theta, theta_daily_per_share, theta_daily_total, position_size, otm_hedge, pnl_table } = data;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <TrendingUp size={16} color="var(--green)" />
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>Theta Harvest Analyzer</h3>
      </div>

      {!is_positive_theta && (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            background: "#fbbf2411",
            border: "1px solid #fbbf2440",
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 13,
            color: "var(--yellow)",
            marginBottom: 16,
          }}
        >
          <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            Theta is <strong>negative</strong> for this position — time decay works against you. Theta harvest
            strategies are most effective for deep ITM contracts with positive theta.
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          {
            label: "Theta per share / day",
            value: `${theta_daily_per_share > 0 ? "+" : ""}${theta_daily_per_share.toFixed(5)}`,
            color: theta_daily_per_share > 0 ? "var(--green)" : "var(--red)",
          },
          {
            label: `Position theta / day (${position_size.toLocaleString()} shares)`,
            value: `${theta_daily_total > 0 ? "+" : ""}$${Math.abs(theta_daily_total).toFixed(4)}`,
            color: theta_daily_total > 0 ? "var(--green)" : "var(--red)",
          },
          otm_hedge && {
            label: "OTM hedge cost (1 contract)",
            value: `$${otm_hedge.price_usd.toFixed(2)}`,
            color: "var(--red)",
          },
          otm_hedge?.breakeven_days != null && {
            label: "Breakeven holding period",
            value: `${otm_hedge.breakeven_days} days`,
            color: "var(--yellow)",
          },
        ]
          .filter(Boolean)
          .map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "12px 16px",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 16, fontWeight: 700, color }}>
                {value}
              </div>
            </div>
          ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* OTM hedge details */}
        {otm_hedge && (
          <div
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "var(--text2)",
                marginBottom: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Tail-Risk Hedge
            </div>
            <Row label="Instrument" value={otm_hedge.instrument} />
            <Row label="Type" value={otm_hedge.type.toUpperCase()} />
            <Row label="Strike" value={`$${otm_hedge.strike.toLocaleString()}`} />
            <Row
              label="1-contract cost"
              value={`$${otm_hedge.price_usd.toFixed(2)}`}
              color="var(--red)"
            />
            {otm_hedge.breakeven_days != null && (
              <Row
                label="Breakeven"
                value={`${otm_hedge.breakeven_days} days`}
                color="var(--yellow)"
              />
            )}
            <div
              style={{
                marginTop: 12,
                fontSize: 11,
                color: "var(--text2)",
                lineHeight: 1.5,
                borderTop: "1px solid var(--border)",
                paddingTop: 10,
              }}
            >
              Buy 1 Deribit {otm_hedge.type} at ${otm_hedge.strike.toLocaleString()} to cap tail
              risk. Break-even is when cumulative theta income equals the hedge cost.
            </div>
          </div>
        )}

        {/* P&L table */}
        <div
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "16px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--text2)",
              marginBottom: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <Clock size={12} />
            Holding Period P&amp;L
          </div>

          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "60px 1fr 1fr 1fr",
              gap: 4,
              fontSize: 11,
              color: "var(--text2)",
              paddingBottom: 6,
              borderBottom: "1px solid var(--border)",
              marginBottom: 4,
            }}
          >
            <span>Days</span>
            <span style={{ textAlign: "right" }}>Gross θ</span>
            <span style={{ textAlign: "right" }}>Hedge</span>
            <span style={{ textAlign: "right" }}>Net P&amp;L</span>
          </div>

          {pnl_table.map(({ days, gross_theta, hedge_cost, net_pnl }) => {
            const netColor = net_pnl > 0 ? "var(--green)" : "var(--red)";
            return (
              <div
                key={days}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 1fr 1fr",
                  gap: 4,
                  fontSize: 12,
                  padding: "5px 0",
                  borderBottom: "1px solid var(--border)",
                  fontFamily: "var(--mono)",
                }}
              >
                <span style={{ color: "var(--text2)" }}>{days}d</span>
                <span
                  style={{
                    textAlign: "right",
                    color: gross_theta > 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  {gross_theta > 0 ? "+" : ""}
                  {gross_theta.toFixed(3)}
                </span>
                <span style={{ textAlign: "right", color: "var(--red)" }}>
                  -{hedge_cost.toFixed(2)}
                </span>
                <span style={{ textAlign: "right", color: netColor, fontWeight: 600 }}>
                  {net_pnl > 0 ? "+" : ""}
                  {net_pnl.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
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
        Hedge cost is for 1 Deribit contract. Continuous theta assumed; GBM model — fat tails and
        oracle risk not priced.
      </div>
    </div>
  );
}
