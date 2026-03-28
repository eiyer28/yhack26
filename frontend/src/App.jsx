import { useState } from "react";
import { Search, TrendingUp, RefreshCw, Activity } from "lucide-react";
import ContractTable from "./components/ContractTable";
import ContractDetail from "./components/ContractDetail";
import { PLACEHOLDER_CONTRACTS, PLACEHOLDER_SPOT } from "./placeholders";
import "./App.css";

function Header({ onRefresh }) {
  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Activity size={20} color="var(--accent)" />
        <span
          style={{
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: "-0.02em",
          }}
        >
          Poly<span style={{ color: "var(--accent)" }}>Greeks</span>
        </span>
        <span
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "2px 7px",
            fontSize: 10,
            color: "var(--text2)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Beta
        </span>
      </div>

      {/* Live spot prices (placeholder) */}
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        {Object.entries(PLACEHOLDER_SPOT).map(([currency, price]) => (
          <div
            key={currency}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color:
                  currency === "BTC" ? "#f7931a" : "#8ea9f0",
              }}
            >
              {currency}
            </span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ${price.toLocaleString()}
            </span>
            {/* TODO: replace with live Deribit spot */}
            <span style={{ fontSize: 10, color: "var(--text2)" }}>(placeholder)</span>
          </div>
        ))}

        <button
          onClick={onRefresh}
          title="Refresh data (placeholder)"
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "5px 10px",
            color: "var(--text2)",
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
          }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>
    </header>
  );
}

function SearchBar({ query, onChange }) {
  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        maxWidth: 400,
      }}
    >
      <Search
        size={15}
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--text2)",
          pointerEvents: "none",
        }}
      />
      <input
        type="text"
        placeholder="Search contracts — BTC 100k, ETH 4000..."
        value={query}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "8px 12px 8px 34px",
          color: "var(--text)",
          fontSize: 13,
          outline: "none",
        }}
      />
    </div>
  );
}

function FilterBar({ filter, onChange, minSpread, onMinSpread }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {["All", "BTC", "ETH"].map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          style={{
            background: filter === f ? "var(--accent)" : "var(--surface2)",
            border: `1px solid ${filter === f ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 6,
            padding: "6px 14px",
            color: filter === f ? "#fff" : "var(--text2)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {f}
        </button>
      ))}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginLeft: 8,
          fontSize: 12,
          color: "var(--text2)",
        }}
      >
        Min |spread|:
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={Math.round(minSpread * 100)}
          onChange={(e) => onMinSpread(Number(e.target.value) / 100)}
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "4px 8px",
            color: "var(--text)",
            fontSize: 13,
            fontFamily: "var(--mono)",
            width: 60,
            outline: "none",
          }}
        />
        pp
      </div>
    </div>
  );
}

function Disclaimer() {
  return (
    <div
      style={{
        background: "#fbbf2409",
        border: "1px solid #fbbf2433",
        borderRadius: 8,
        padding: "10px 16px",
        fontSize: 11,
        color: "var(--yellow)",
        marginBottom: 16,
        lineHeight: 1.6,
      }}
    >
      <strong>Model assumptions:</strong> Continuous GBM · no transaction costs · no oracle/resolution risk ·
      5% risk-free rate · arbitrage assumed possible but not frictionless. Deribit IV sourced via
      variance-linear interpolation. Not financial advice.
    </div>
  );
}

export default function App() {
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("All");
  const [minSpread, setMinSpread] = useState(0);

  // TODO: replace with live API fetch from /api/markets
  const filtered = PLACEHOLDER_CONTRACTS.filter((c) => {
    const matchCurrency =
      currencyFilter === "All" || c.currency === currencyFilter;
    const matchQuery =
      !query ||
      c.question.toLowerCase().includes(query.toLowerCase()) ||
      c.currency.toLowerCase().includes(query.toLowerCase());
    const matchSpread =
      Math.abs(c.p_market - c.p_model) >= minSpread;
    return matchCurrency && matchQuery && matchSpread;
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header onRefresh={() => {/* TODO: re-fetch from API */}} />

      <main style={{ flex: 1, padding: "24px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
        {selected ? (
          <ContractDetail
            contract={selected}
            onBack={() => setSelected(null)}
            spotPrices={PLACEHOLDER_SPOT}
          />
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 16,
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                  Crypto Markets
                </h1>
                <p style={{ color: "var(--text2)", fontSize: 13 }}>
                  {filtered.length} contract{filtered.length !== 1 ? "s" : ""} · ranked by spread magnitude (|p_PM − p_BS|)
                </p>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <SearchBar query={query} onChange={setQuery} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <FilterBar
                filter={currencyFilter}
                onChange={setCurrencyFilter}
                minSpread={minSpread}
                onMinSpread={setMinSpread}
              />
            </div>

            <Disclaimer />

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {filtered.length === 0 ? (
                <div
                  style={{
                    padding: "48px",
                    textAlign: "center",
                    color: "var(--text2)",
                    fontSize: 14,
                  }}
                >
                  No contracts match your filters.
                </div>
              ) : (
                <ContractTable
                  contracts={filtered}
                  selected={selected}
                  onSelect={setSelected}
                />
              )}
            </div>

            {/* Footer note */}
            <div style={{ marginTop: 16, fontSize: 11, color: "var(--text2)", textAlign: "center" }}>
              Data sources: Polymarket Gamma API · Deribit public REST API · All data is placeholder until backend is connected.
            </div>
          </>
        )}
      </main>
    </div>
  );
}
