export default function PayoffSurface({ marketId }) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>Payoff Surface</h3>
        <div style={{ color: "var(--text2)", fontSize: 12, marginTop: 2 }}>
          P&amp;L per share · drag to rotate · scroll to zoom ·
          green = profit, red = loss, white = breakeven
        </div>
      </div>
      <iframe
        src={`/api/markets/${marketId}/surface-plot`}
        style={{
          width: "100%",
          height: 480,
          border: "none",
          borderRadius: 8,
          background: "#0d1117",
        }}
        title="Payoff Surface"
      />
    </div>
  );
}
