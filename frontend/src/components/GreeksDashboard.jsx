import { Info } from "lucide-react";

const GREEK_INFO = {
  Delta: {
    label: "Delta",
    symbol: "Δ",
    color: "var(--accent)",
    description:
      "Change in contract value per $1 move in the underlying. Binary deltas are small and can flip sign near expiry.",
    unit: "$/$ spot move",
  },
  Gamma: {
    label: "Gamma",
    symbol: "Γ",
    color: "var(--yellow)",
    description:
      "Rate of change of delta. Negative for ITM contracts — delta falls as underlying rises past strike.",
    unit: "Δ per $ spot move",
  },
  Theta: {
    label: "Theta (daily)",
    symbol: "Θ",
    color: "var(--green)",
    description:
      "Value change per calendar day. Can be POSITIVE for deep ITM contracts — time working in your favour.",
    unit: "$/day",
  },
  Vega: {
    label: "Vega",
    symbol: "ν",
    color: "var(--purple)",
    description:
      "Value change per 1% move in implied vol. Negative for ITM — rising vol hurts ITM binary positions.",
    unit: "$ per 1% vol",
  },
};

function GreekCard({ name, rawValue, positionValue, positionSize }) {
  const info = GREEK_INFO[name];
  const isPositive = positionValue >= 0;
  const absPos = Math.abs(positionValue);

  const fmt = (v) => {
    if (Math.abs(v) < 0.001) return v.toExponential(2);
    return v.toFixed(4);
  };

  return (
    <div
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: info.color,
              fontFamily: "var(--mono)",
            }}
          >
            {info.symbol}
          </span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{info.label}</span>
        </div>
        <div
          title={info.description}
          style={{ color: "var(--text2)", cursor: "help" }}
        >
          <Info size={14} />
        </div>
      </div>

      {/* Per-share value */}
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--text2)",
        }}
      >
        per share: {fmt(rawValue)}
      </div>

      {/* Position value */}
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 20,
          fontWeight: 700,
          color: isPositive ? "var(--green)" : "var(--red)",
        }}
      >
        {isPositive ? "+" : ""}
        {fmt(positionValue)}
      </div>

      <div style={{ fontSize: 11, color: "var(--text2)" }}>
        for {positionSize.toLocaleString()} shares · {info.unit}
      </div>

      <div
        style={{
          fontSize: 11,
          color: "var(--text2)",
          lineHeight: 1.4,
          marginTop: 2,
          borderTop: "1px solid var(--border)",
          paddingTop: 8,
        }}
      >
        {info.description}
      </div>
    </div>
  );
}

export default function GreeksDashboard({ greeks, contract }) {
  if (!greeks) return null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Greeks Dashboard</h3>
          <div style={{ color: "var(--text2)", fontSize: 12, marginTop: 2 }}>
            σ = {(greeks.sigma * 100).toFixed(1)}% · {greeks.sigma_source}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ color: "var(--text2)", fontSize: 11 }}>d1</div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {greeks.d1.toFixed(4)}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text2)", fontSize: 11 }}>d2</div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {greeks.d2.toFixed(4)}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text2)", fontSize: 11 }}>
              Position value
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--green)",
              }}
            >
              ${greeks.position_value.toFixed(0)}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <GreekCard
          name="Delta"
          rawValue={greeks.delta}
          positionValue={greeks.position_delta}
          positionSize={greeks.position_size}
        />
        <GreekCard
          name="Gamma"
          rawValue={greeks.gamma}
          positionValue={greeks.position_gamma}
          positionSize={greeks.position_size}
        />
        <GreekCard
          name="Theta"
          rawValue={greeks.theta_daily}
          positionValue={greeks.position_theta_daily}
          positionSize={greeks.position_size}
        />
        <GreekCard
          name="Vega"
          rawValue={greeks.vega}
          positionValue={greeks.position_vega}
          positionSize={greeks.position_size}
        />
      </div>
    </div>
  );
}
