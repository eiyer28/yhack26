import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const fmt = {
  pct: (v) => `${(v * 100).toFixed(1)}%`,
  usd: (v) =>
    v >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(1)}M`
      : `$${(v / 1_000).toFixed(0)}K`,
  strike: (v) =>
    v >= 1000
      ? `$${v.toLocaleString()}`
      : `$${v.toLocaleString()}`,
};

function SpreadBadge({ spread }) {
  const abs = Math.abs(spread);
  const color =
    abs > 0.1
      ? "var(--red)"
      : abs > 0.05
      ? "var(--yellow)"
      : "var(--green)";
  const sign = spread > 0 ? "+" : "";
  return (
    <span
      style={{
        color,
        fontFamily: "var(--mono)",
        fontWeight: 600,
        fontSize: 13,
      }}
    >
      {sign}
      {fmt.pct(spread)}
    </span>
  );
}

function SpreadIcon({ spread }) {
  if (spread > 0.02) return <TrendingUp size={14} color="var(--red)" />;
  if (spread < -0.02) return <TrendingDown size={14} color="var(--green)" />;
  return <Minus size={14} color="var(--text2)" />;
}

export default function ContractTable({ contracts, selected, onSelect }) {
  const sorted = [...contracts].sort(
    (a, b) =>
      Math.abs(b.p_market - b.p_model) - Math.abs(a.p_market - a.p_model)
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {[
              "Contract",
              "Asset",
              "Strike",
              "Expiry",
              "p_PM",
              "p_BS",
              "Spread",
              "Vol (σ)",
              "Volume",
            ].map((h) => (
              <th
                key={h}
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  color: "var(--text2)",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  fontSize: 12,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const spread = c.p_market - c.p_model;
            const isSelected = selected?.id === c.id;
            return (
              <tr
                key={c.id}
                onClick={() => onSelect(c)}
                style={{
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  background: isSelected ? "var(--surface2)" : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "#15191f";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <td style={{ padding: "10px 12px", maxWidth: 260 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <SpreadIcon spread={spread} />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: isSelected ? "var(--accent)" : "var(--text)",
                      }}
                    >
                      {c.question}
                    </span>
                  </div>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span
                    style={{
                      background:
                        c.currency === "BTC" ? "#f7931a22" : "#627eea22",
                      color: c.currency === "BTC" ? "#f7931a" : "#8ea9f0",
                      borderRadius: 4,
                      padding: "2px 7px",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {c.currency}
                  </span>
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    fontFamily: "var(--mono)",
                    fontSize: 13,
                  }}
                >
                  {fmt.strike(c.strike)}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    color: "var(--text2)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.resolution_date}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    fontFamily: "var(--mono)",
                    color: "var(--text)",
                  }}
                >
                  {fmt.pct(c.p_market)}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    fontFamily: "var(--mono)",
                    color: "var(--purple)",
                  }}
                >
                  {fmt.pct(c.p_model)}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <SpreadBadge spread={spread} />
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    fontFamily: "var(--mono)",
                    color: "var(--text2)",
                    fontSize: 13,
                  }}
                >
                  {(c.sigma * 100).toFixed(0)}%
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    fontFamily: "var(--mono)",
                    color: "var(--text2)",
                    fontSize: 13,
                  }}
                >
                  {fmt.usd(c.volume)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
