import { Shield, AlertTriangle, ArrowRight } from "lucide-react";

// Parse Deribit instrument name, e.g. "BTC-27JUN25-61000-P"
function parseInstrument(name) {
  const parts = name.split("-");
  if (parts.length < 4) return null;
  const [asset, expRaw, strikeRaw, typeCode] = parts;
  const type = typeCode === "P" ? "Put" : "Call";
  const strike = Number(strikeRaw).toLocaleString();
  // expRaw like "27JUN25" → "Jun 27, 2025"
  const day = expRaw.slice(0, 2);
  const mon = expRaw.slice(2, 5)[0] + expRaw.slice(2, 5).slice(1).toLowerCase();
  const yr  = "20" + expRaw.slice(5);
  return { asset, type, strike, expiry: `${mon} ${day}, ${yr}` };
}

function LegCard({ step, venue, action, actionColor, description, detail, cost }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text2)",
            flexShrink: 0,
          }}
        >
          {step}
        </div>
        <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {venue}
        </span>
      </div>

      <div style={{ fontSize: 20, fontWeight: 700 }}>
        <span style={{ color: actionColor }}>{action}</span>
        {" "}
        <span>{description}</span>
      </div>

      {detail && (
        <div style={{ fontSize: 12, color: "var(--text2)", fontFamily: "var(--mono)" }}>
          {detail}
        </div>
      )}

      <div style={{ fontSize: 13, fontFamily: "var(--mono)", color: "var(--text)", fontWeight: 600, marginTop: 2 }}>
        {cost}
      </div>
    </div>
  );
}

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

export default function HedgeCalculator({ hedge, contract, positionSize }) {
  if (!hedge) return null;

  const inst = parseInstrument(hedge.deribit_instrument);
  const deribitAbs = Math.abs(hedge.deribit_size);
  const deribitAction = hedge.deribit_size >= 0 ? "Buy" : "Sell";
  const deribitColor  = hedge.deribit_size >= 0 ? "var(--green)" : "var(--red)";

  const polyAction = "Buy";
  const polyTokenLabel = contract.direction === "above" ? "YES" : "NO";
  const polyTotalCost = (contract.p_model * positionSize).toFixed(2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Shield size={16} color="var(--accent)" />
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>Hedge Calculator</h3>
      </div>

      {/* Trade instruction legs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <LegCard
          step="1"
          venue="Polymarket"
          action={polyAction}
          actionColor="var(--green)"
          description={`${positionSize.toLocaleString()} ${polyTokenLabel} shares`}
          detail={`Contract: ${contract.question}`}
          cost={`Total cost: $${polyTotalCost} · Max payout: $${positionSize.toLocaleString()}`}
        />

        <div style={{ display: "flex", justifyContent: "center" }}>
          <ArrowRight size={16} color="var(--text2)" style={{ transform: "rotate(90deg)" }} />
        </div>

        <LegCard
          step="2"
          venue="Deribit"
          action={deribitAction}
          actionColor={deribitColor}
          description={`${deribitAbs.toFixed(4)} ${inst ? `${inst.asset} ${inst.type}` : hedge.deribit_instrument} contract${deribitAbs !== 1 ? "s" : ""}`}
          detail={inst ? `Strike: $${inst.strike} · Expiry: ${inst.expiry} · ${hedge.deribit_instrument}` : hedge.deribit_instrument}
          cost={`Price: $${hedge.deribit_price.toFixed(2)}/contract · Total: $${hedge.hedge_cost_usd.toFixed(2)}`}
        />
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
          Combined Portfolio Greeks (after hedge)
        </div>
        <GreekRow label="Δ Delta"        value={hedge.combined_delta}       highlight={hedge.hedge_type === "delta"} />
        <GreekRow label="ν Vega"         value={hedge.combined_vega}        highlight={hedge.hedge_type === "vega"} />
        <GreekRow label="Θ Theta/day"    value={hedge.combined_theta_daily} />
        <GreekRow label="Γ Gamma"        value={hedge.residual_gamma} />

        {hedge.note && (
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
            {hedge.note}
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: "var(--text2)" }}>
        Continuous hedging assumed. Transaction costs and oracle/resolution risk not modeled.
      </div>
    </div>
  );
}
