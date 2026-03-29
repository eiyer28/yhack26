import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

function Math({ tex, display = false }) {
  const ref = useRef();
  useEffect(() => {
    if (ref.current) {
      katex.render(tex, ref.current, {
        displayMode: display,
        throwOnError: false,
      });
    }
  }, [tex, display]);
  return <span ref={ref} />;
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 20,
          paddingBottom: 10,
          borderBottom: "1px solid var(--border)",
          color: "var(--text)",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "18px 22px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function AudienceItem({ title, desc }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
      <span style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>{desc}</span>
    </div>
  );
}

function UseCase({ n, title, desc }) {
  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--accent)",
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {n}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7 }}>{desc}</div>
      </div>
    </div>
  );
}

function GreekRow({ greek, formula, diff }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "90px 1fr 1fr",
        gap: 16,
        padding: "12px 0",
        borderBottom: "1px solid var(--border)",
        alignItems: "center",
        fontSize: 13,
      }}
    >
      <span style={{ fontWeight: 700, color: "var(--accent)", fontFamily: "var(--mono)" }}>{greek}</span>
      <span><Math tex={formula} /></span>
      <span style={{ color: "var(--text2)", lineHeight: 1.5 }}>{diff}</span>
    </div>
  );
}

export default function About() {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>

      {/* Hero */}
      <div style={{ marginBottom: 48, paddingTop: 8 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12, letterSpacing: "-0.02em" }}>
          About <span style={{ color: "var(--accent)" }}>PolyGreeks</span>
        </h1>
        <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.8, maxWidth: 700 }}>
          TradFi-style risk analytics for Polymarket prediction markets. PolyGreeks prices
          Polymarket crypto contracts as cash-or-nothing binary European options, sources
          implied volatility from live Deribit options markets, and computes the full set of
          Greeks for any position. The spread between Polymarket's crowd-implied probability
          and the model-implied probability is a measurable mispricing — and the Greeks tell
          you exactly how to hedge it.
        </p>
      </div>

      {/* Who this is for */}
      <Section title="Who this is for">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <Card>
            <AudienceItem
              title="Options traders & vol desks"
              desc="Trade on Deribit and want to extend your edge into Polymarket with the same Greek-based intuition you already use."
            />
          </Card>
          <Card>
            <AudienceItem
              title="Quant researchers"
              desc="Studying cross-venue mispricings between crowd-implied probabilities and what the options market prices in."
            />
          </Card>
          <Card>
            <AudienceItem
              title="Polymarket market makers"
              desc="Need Greeks to reason about hedging and inventory risk on contracts you're quoting."
            />
          </Card>
          <Card>
            <AudienceItem
              title="TradFi-to-crypto crossover traders"
              desc="Comfortable with Black-Scholes and options intuition but new to the prediction market structure."
            />
          </Card>
        </div>
        <Card style={{ background: "var(--surface)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
            What you need
          </div>
          <ul style={{ fontSize: 13, color: "var(--text2)", lineHeight: 2, paddingLeft: 18 }}>
            <li>Familiarity with options Greeks (delta, gamma, vega, theta)</li>
            <li>Understanding of the Black-Scholes model and options pricing</li>
            <li>
              A <strong style={{ color: "var(--text)" }}>Deribit</strong> account for executing hedges — Deribit is a professional
              derivatives exchange built for advanced traders, with deep BTC/ETH options books
              and low-latency execution
            </li>
            <li>A <strong style={{ color: "var(--text)" }}>Polymarket</strong> account for the prediction market leg of any trade</li>
          </ul>
        </Card>
      </Section>

      {/* Use cases */}
      <Section title="Intended use cases">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <UseCase
            n="1"
            title="Spotting mispricings before they close"
            desc="The dashboard ranks live Polymarket crypto contracts by |p_PM − p_BS|. Contracts near the top represent the largest divergences between crowd sentiment and what the options market implies. A trader can evaluate whether the gap is tradeable or explained by model limitations before it closes."
          />
          <UseCase
            n="2"
            title="Hedging a Polymarket position with Deribit options"
            desc="If you hold YES shares on a BTC contract, you have unhedged directional exposure to BTC's price. The hedge calculator identifies the specific Deribit instrument, tells you exactly how many contracts to buy or sell, and shows what your combined portfolio Greeks look like after both legs are on."
          />
          <UseCase
            n="3"
            title="Harvesting theta on deep ITM contracts"
            desc="Deep in-the-money binary positions accrue positive theta — a property vanilla options don't have. A trader holding a high-probability YES position is being paid by time decay rather than paying it. The theta harvest analyzer quantifies this daily income and shows the cost of an OTM Deribit put to cap tail risk."
          />
          <UseCase
            n="4"
            title="Scenario analysis before entering"
            desc="The What-If simulator lets you drag BTC spot price and implied vol sliders to see how model probability, delta, gamma, theta, and vega respond before putting on a trade — useful for stress-testing against a vol spike or a sudden price move."
          />
          <UseCase
            n="5"
            title="Building intuition about binary options Greeks"
            desc="Binary Greeks behave very differently from vanilla: delta is bell-shaped, vega flips sign at ATM, gamma can go negative. Even an institutionally experienced equity options trader will not immediately have intuition about these contracts. This tool surfaces those differences visually so traders can calibrate before sizing positions."
          />
        </div>
      </Section>

      {/* Core insight */}
      <Section title="The core insight">
        <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.8, marginBottom: 20 }}>
          A Polymarket contract like <em>"BTC &gt; $80k by June 27"</em> is structurally identical to a
          cash-or-nothing binary call option: it pays $1 if the condition is met, $0 otherwise.
          The binary variant of Black-Scholes applies directly.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {[
            ["Market price implies a probability:", "p_{PM} = \\text{live Polymarket price}"],
            ["Deribit vol surface implies a model probability:", "p_{BS} = \\mathcal{N}(d_2)"],
            ["The spread is the exploitable mispricing:", "|p_{PM} - p_{BS}|"],
          ].map(([label, tex]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
              <span style={{ color: "var(--text2)", minWidth: 280 }}>{label}</span>
              <Card style={{ padding: "8px 16px", display: "inline-block" }}>
                <Math tex={tex} />
              </Card>
            </div>
          ))}
        </div>
        <Card>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>
            Binary option pricing formula
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
            <Math display tex="V = e^{-rT} \mathcal{N}(\phi \, d_2)" />
            <Math display tex="d_2 = \frac{\ln(S/K) + \left(r - \tfrac{1}{2}\sigma^2\right)T}{\sigma\sqrt{T}}" />
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: "var(--text2)", lineHeight: 1.8 }}>
            where <Math tex="\phi = +1" /> for a call (YES share) and <Math tex="\phi = -1" /> for a put (NO share) ·{" "}
            <Math tex="S" /> = spot price · <Math tex="K" /> = strike · <Math tex="T" /> = time to expiry (years) ·{" "}
            <Math tex="\sigma" /> = implied vol (from Deribit) · <Math tex="r = 5\%" /> risk-free rate
          </div>
        </Card>
      </Section>

      {/* Greeks */}
      <Section title="Greeks">
        <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.8, marginBottom: 20 }}>
          PolyGreeks computes four risk sensitivities for any position. These are qualitatively
          distinct from vanilla options Greeks — even experienced equity options traders will not
          have immediate intuition about these contracts.
        </p>
        <Card style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "90px 1fr 1fr",
              gap: 16,
              paddingBottom: 10,
              marginBottom: 4,
              borderBottom: "1px solid var(--border)",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text2)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            <span>Greek</span>
            <span>Binary formula</span>
            <span>Key difference from vanilla</span>
          </div>
          <GreekRow
            greek="Delta (Δ)"
            formula="\dfrac{\phi \, e^{-rT} n(d_2)}{S \sigma \sqrt{T}}"
            diff="Bell-shaped, peaks at-the-money then collapses. Not monotone like vanilla."
          />
          <GreekRow
            greek="Gamma (Γ)"
            formula="-\dfrac{\phi \, e^{-rT} n(d_2) \, d_1}{S^2 \sigma^2 T}"
            diff="Changes sign at the strike. ITM binary is short gamma — unlike vanilla which is always positive."
          />
          <GreekRow
            greek="Vega (ν)"
            formula="-\dfrac{\phi \, e^{-rT} d_1 \, n(d_2)}{\sigma}"
            diff="Negative for ITM contracts. Rising vol hurts a deep ITM position — opposite to vanilla."
          />
          <GreekRow
            greek="Theta (Θ)"
            formula="e^{-rT}\!\left(\phi \, n(d_2)\dfrac{d_2}{2T\sigma\sqrt{T}} + r\,\mathcal{N}(\phi d_2)\right)"
            diff="Can be positive for deep ITM positions. Time decay helps you when you're nearly certain to be paid out."
          />
        </Card>

        {/* Plots */}
        <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.8, marginBottom: 16 }}>
          Cross-sections of each Greek vs underlying price <Math tex="S" /> and time to expiry <Math tex="T" />,
          for both binary and vanilla calls/puts.
          Parameters: <Math tex="K=100" />, <Math tex="\sigma=0.3" />, <Math tex="r=0.05" />,{" "}
          <Math tex="T=0.5" /> fixed for <Math tex="S" />-sections, <Math tex="S=100" /> fixed for <Math tex="T" />-sections.
        </div>
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <img
            src="/greeks_plots.png"
            alt="Greeks cross-sections: binary vs vanilla"
            style={{ width: "100%", display: "block" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
          {[
            ["Delta", "Binary call delta is bell-shaped and peaks ATM, then collapses — while vanilla delta is a monotone S-curve. As T → 0 near ATM, binary delta diverges, making near-expiry contracts extremely difficult to hedge."],
            ["Gamma", "Binary gamma changes sign at the strike. An OTM binary is long gamma (like vanilla), but an ITM binary is short gamma — the opposite of all vanilla options, which always have positive gamma."],
            ["Vega", "Binary vega changes sign at ATM. If you hold a deep ITM YES share (say 85% probability), you have negative vega — rising BTC vol hurts your position by increasing the chance of falling back OTM. Vanilla vega is always positive."],
            ["Theta", "Deep ITM binary positions have positive theta. Time passing is good when you're nearly certain to be paid out. This makes theta harvesting mathematically possible in a way that it isn't for vanilla options."],
          ].map(([label, text]) => (
            <Card key={label} style={{ display: "flex", gap: 14, padding: "14px 18px" }}>
              <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13, minWidth: 50, fontFamily: "var(--mono)" }}>{label}</span>
              <span style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7 }}>{text}</span>
            </Card>
          ))}
        </div>
      </Section>

      {/* Alpha opportunities */}
      <Section title="Alpha opportunities">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            {
              title: "1. Probability mispricing",
              color: "var(--accent)",
              items: [
                "Take the opposing side on Polymarket when |p_PM − p_BS| exceeds ~3–5pp",
                "Hedge directional BTC exposure via Deribit options",
                "Net position: long the probability spread, delta-neutral",
              ],
            },
            {
              title: "2. Vega arbitrage",
              color: "var(--purple)",
              items: [
                "ITM binary contracts have negative vega",
                "Buy YES on Polymarket (cheap relative to model) when Deribit vol is elevated",
                "Short vega on Deribit to hedge",
                "Net: probability-long, vega-neutral",
              ],
            },
            {
              title: "3. Theta harvesting",
              color: "var(--green)",
              items: [
                "Deep ITM contracts (e.g. 85%) have positive theta",
                "Hold YES on Polymarket and collect daily theta income",
                "Buy OTM puts on Deribit to cap tail risk",
                "Net: long theta, bounded downside",
              ],
            },
          ].map(({ title, color, items }) => (
            <Card key={title} style={{ borderTop: `2px solid ${color}` }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color }}>{title}</div>
              <ul style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.9, paddingLeft: 16 }}>
                {items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </Card>
          ))}
        </div>
        <Card style={{ marginTop: 16, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10 }}>Combined Greek P&amp;L for a delta-neutral book</div>
          <Math display tex="d\Pi = \frac{1}{2}\Gamma_{\text{net}}(dS)^2 - \Theta_{\text{net}}\,dt" />
        </Card>
      </Section>

      {/* Data sources */}
      <Section title="Data sources">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {[
            ["Polymarket Gamma API", "Live market probabilities", "gamma-api.polymarket.com/markets"],
            ["Polymarket CLOB", "Order book depth and historical prices", "clob.polymarket.com"],
            ["Deribit REST API", "Implied vol surface, Greeks, spot prices", "deribit.com/api/v2/public/…"],
          ].map(([source, data, endpoint]) => (
            <Card key={source} style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr", gap: 16, alignItems: "center", padding: "12px 18px" }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{source}</span>
              <span style={{ fontSize: 13, color: "var(--text2)" }}>{data}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text2)" }}>{endpoint}</span>
            </Card>
          ))}
        </div>
        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.8, marginBottom: 16 }}>
          Deribit is a professional derivatives exchange designed for advanced traders, with deep
          BTC and ETH options books and low-latency execution. Its public API provides real-time
          implied vol across all strikes and expiries at no cost or authentication required.
        </p>
        <Card>
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 14 }}>
            Vol is interpolated across expiries using variance-linear interpolation to match Polymarket's exact resolution date:
          </div>
          <div style={{ textAlign: "center" }}>
            <Math display tex="\sigma_{\text{interp}} = \sqrt{\dfrac{T_2 - T}{T_2 - T_1}\sigma_1^2 + \dfrac{T - T_1}{T_2 - T_1}\sigma_2^2}" />
          </div>
        </Card>
      </Section>

      {/* Model assumptions */}
      <Section title="Model assumptions">
        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.8, marginBottom: 16 }}>
          These assumptions are stated explicitly so users can reason about model-level risk.
          We recommend only acting on trades where <Math tex="|p_{PM} - p_{BS}|" /> exceeds roughly 3–5pp to
          account for the gap between the model and reality.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            ["GBM assumed", "Underlying follows Geometric Brownian Motion. Fat tails not captured."],
            ["Continuous hedging", "Idealized continuous rebalancing assumed, as in Black-Scholes. Transaction costs not modeled."],
            ["No oracle risk", "Resolution/oracle risk not priced. There is no analog to this in exchange-traded options."],
            ["5% risk-free rate", "Risk-free rate approximated at 5% annualized."],
            ["European structure", "Contracts treated as European options. Accurate since Polymarket contracts resolve automatically at expiry."],
            ["Frictionless arb", "Arbitrage between Polymarket and Deribit assumed possible but not frictionless in practice."],
          ].map(([label, desc]) => (
            <Card key={label} style={{ padding: "12px 16px" }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: "var(--yellow)" }}>{label}</div>
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>{desc}</div>
            </Card>
          ))}
        </div>
      </Section>

      {/* References */}
      <Section title="References">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            "Black, F. & Scholes, M. (1973). The Pricing of Options and Corporate Liabilities. Journal of Political Economy.",
            "Reiner, E. & Rubinstein, M. (1991). Unscrambling the Binary Code. Risk Magazine.",
            "QuantPie. Cash-or-Nothing Options: Greeks Derivation. quantpie.co.uk",
            "Deribit API Documentation. docs.deribit.com",
            "Polymarket Documentation. docs.polymarket.com",
          ].map((ref) => (
            <div key={ref} style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, paddingLeft: 16, borderLeft: "2px solid var(--border)" }}>
              {ref}
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
}
