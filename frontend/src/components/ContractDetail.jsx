import { useState, useEffect } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import GreeksDashboard from "./GreeksDashboard";
import SpreadChart from "./SpreadChart";
import PayoffSurface from "./PayoffSurface";
import HedgeCalculator from "./HedgeCalculator";

const TABS = ["Overview", "Payoff Surface", "Hedge Calculator"];

function ProbBar({ label, value, color }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
          fontSize: 12,
        }}
      >
        <span style={{ color: "var(--text2)" }}>{label}</span>
        <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color }}>
          {(value * 100).toFixed(1)}%
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: "var(--border)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${value * 100}%`,
            background: color,
            borderRadius: 4,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

function Loading({ label }) {
  return (
    <div style={{ padding: "32px", textAlign: "center", color: "var(--text2)", fontSize: 13 }}>
      {label}
    </div>
  );
}

function Empty({ label }) {
  return (
    <div style={{ padding: "32px", textAlign: "center", color: "var(--text2)", fontSize: 13 }}>
      {label}
    </div>
  );
}

export default function ContractDetail({ contract, onBack, spotPrices }) {
  const [positionSize, setPositionSize] = useState(1000);
  const [hedgeType, setHedgeType]       = useState("delta");
  const [activeTab, setActiveTab]       = useState("Overview");

  const [history, setHistory]           = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [hedge, setHedge]               = useState(null);
  const [hedgeLoading, setHedgeLoading] = useState(false);

  const marketId = contract.id;

  // Fetch history on mount (it's on the default Overview tab)
  useEffect(() => {
    setHistoryLoading(true);
    fetch(`/api/markets/${marketId}/history`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setHistory(d))
      .catch(() => setHistory(null))
      .finally(() => setHistoryLoading(false));
  }, [marketId]);

  // Fetch hedge whenever Hedge Calculator tab is active, or position size / type changes
  useEffect(() => {
    if (activeTab !== "Hedge Calculator") return;
    setHedgeLoading(true);
    setHedge(null);
    fetch(`/api/markets/${marketId}/hedge?position_size=${positionSize}&hedge_type=${hedgeType}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setHedge(d))
      .catch(() => setHedge(null))
      .finally(() => setHedgeLoading(false));
  }, [activeTab, marketId, positionSize, hedgeType]);

  // Build greeks display object from real backend data, scaled to position size
  const g = contract.greeks ?? {};
  const greeks = {
    delta:                g.delta        ?? 0,
    gamma:                g.gamma        ?? 0,
    vega:                 (g.vega        ?? 0) / 100,
    theta_daily:          g.theta_daily  ?? 0,
    position_delta:       (g.delta       ?? 0) * positionSize,
    position_gamma:       (g.gamma       ?? 0) * positionSize,
    position_vega:        ((g.vega       ?? 0) / 100) * positionSize,
    position_theta_daily: (g.theta_daily ?? 0) * positionSize,
    position_value:       (contract.p_model ?? 0) * positionSize,
    position_size:        positionSize,
    sigma:                contract.sigma ?? 0,
    sigma_source:         contract.vol_debug?.method ?? "Deribit",
    d1:                   g.d1 ?? 0,
    d2:                   g.d2 ?? 0,
  };

  const spread = contract.p_market - contract.p_model;
  const spreadAbs = Math.abs(spread);
  const spreadColor =
    spreadAbs > 0.1
      ? "var(--red)"
      : spreadAbs > 0.05
      ? "var(--yellow)"
      : "var(--green)";

  const spot = spotPrices?.[contract.currency] ?? "—";

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 12px",
            color: "var(--text2)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
          }}
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <h2 style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>
          {contract.question}
        </h2>
        <a
          href={`https://polymarket.com/event/${contract.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--text2)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            textDecoration: "none",
          }}
        >
          Polymarket <ExternalLink size={12} />
        </a>
      </div>

      {/* Summary row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          {
            label: "Asset",
            value: contract.currency,
            color: contract.currency === "BTC" ? "#f7931a" : "#8ea9f0",
          },
          { label: "Strike", value: `$${contract.strike.toLocaleString()}`, color: "var(--text)" },
          { label: "Spot Price", value: `$${spot.toLocaleString()}`, color: "var(--text)" },
          { label: "Resolution", value: contract.resolution_date, color: "var(--text2)" },
          { label: "Implied Vol (σ)", value: `${(contract.sigma * 100).toFixed(0)}%`, color: "var(--purple)" },
          { label: "Spread", value: `${spread > 0 ? "+" : ""}${(spread * 100).toFixed(1)}%`, color: spreadColor },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "12px 16px",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>
              {label}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "var(--mono)",
                color,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Probability comparison */}
      <div
        style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>
            Model vs Market Probability
          </h3>
          <span
            style={{
              background: spreadColor + "22",
              color: spreadColor,
              borderRadius: 6,
              padding: "3px 10px",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "var(--mono)",
            }}
          >
            {spreadAbs > 0.05 ? "MISPRICING SIGNAL" : "WITHIN THRESHOLD"}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ProbBar label="p_PM — Polymarket crowd" value={contract.p_market} color="var(--accent)" />
          <ProbBar label="p_BS — Binary B-S model (Deribit σ)" value={contract.p_model} color="var(--purple)" />
        </div>
        {spreadAbs > 0.05 && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: spreadColor,
              fontFamily: "var(--mono)",
            }}
          >
            Spread: {spread > 0 ? "+" : ""}{(spread * 100).toFixed(1)}pp —{" "}
            {spread > 0
              ? "Market overpricing vs model. Possible short candidate."
              : "Market underpricing vs model. Possible long candidate."}
          </div>
        )}
      </div>

      {/* Position size input */}
      <div
        style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "14px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 600 }}>Position Size</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            min={1}
            max={100000}
            value={positionSize}
            onChange={(e) =>
              setPositionSize(Math.max(1, Number(e.target.value)))
            }
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "6px 12px",
              color: "var(--text)",
              fontSize: 14,
              fontFamily: "var(--mono)",
              width: 120,
              outline: "none",
            }}
          />
          <span style={{ color: "var(--text2)", fontSize: 13 }}>shares</span>
        </div>
        <div style={{ color: "var(--text2)", fontSize: 13 }}>
          Entry cost:{" "}
          <span
            style={{ color: "var(--text)", fontFamily: "var(--mono)", fontWeight: 600 }}
          >
            ${(contract.p_model * positionSize).toFixed(2)}
          </span>
        </div>
        <div style={{ color: "var(--text2)", fontSize: 13 }}>
          Max payout:{" "}
          <span
            style={{ color: "var(--green)", fontFamily: "var(--mono)", fontWeight: 600 }}
          >
            ${positionSize.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 0,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none",
              border: "none",
              borderBottom: `2px solid ${activeTab === tab ? "var(--accent)" : "transparent"}`,
              padding: "8px 16px",
              color: activeTab === tab ? "var(--accent)" : "var(--text2)",
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: 13,
              marginBottom: -1,
              transition: "all 0.1s",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "20px",
        }}
      >
        {activeTab === "Overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <GreeksDashboard greeks={greeks} contract={contract} />
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 24 }}>
              {historyLoading && <Loading label="Fetching price history..." />}
              {!historyLoading && history && history.length > 0 && (
                <SpreadChart data={history} />
              )}
              {!historyLoading && (!history || history.length === 0) && (
                <Empty label="No price history available for this contract." />
              )}
            </div>
          </div>
        )}
        {activeTab === "Payoff Surface" && (
          <PayoffSurface marketId={marketId} />
        )}
        {activeTab === "Hedge Calculator" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["delta", "vega"].map((t) => (
                <button
                  key={t}
                  onClick={() => setHedgeType(t)}
                  style={{
                    background:   hedgeType === t ? "var(--accent)" : "var(--surface)",
                    border:       `1px solid ${hedgeType === t ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 6,
                    padding:      "6px 14px",
                    color:        hedgeType === t ? "#fff" : "var(--text2)",
                    fontSize:     13,
                    fontWeight:   600,
                  }}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}-Neutral
                </button>
              ))}
            </div>
            {hedgeLoading && <Loading label="Computing hedge..." />}
            {!hedgeLoading && hedge && <HedgeCalculator hedge={hedge} contract={contract} />}
            {!hedgeLoading && !hedge && <Empty label="Could not compute hedge (no suitable Deribit instrument found)." />}
          </div>
        )}
      </div>
    </div>
  );
}
