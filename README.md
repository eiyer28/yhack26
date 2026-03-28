# PolyGreeks

**TradFi-style risk analytics for Polymarket prediction markets.**

PolyGreeks prices Polymarket crypto contracts as cash-or-nothing binary options, sources implied volatility from Deribit, and computes Greeks for any position. The spread between Polymarket's crowd-implied probability and the model-implied probability surfaces hedgeable mispricings — and the Greeks tell you exactly how to hedge them.

---

## The core insight

A Polymarket contract like *"BTC > $80k by June 27"* is structurally identical to a **cash-or-nothing binary call option**: it pays $1 if the condition is met, $0 otherwise. This means the full machinery of binary options pricing applies:

- The market price implies a probability: $p_{PM} = \text{live Polymarket price}$
- Deribit's implied vol surface implies a separate model probability: $p_{BS} = \mathcal{N}(d_2)$
- The spread $|p_{PM} - p_{BS}|$ is a measurable, hedgeable mispricing

Binary option pricing formula:

$$V = e^{-rT} \mathcal{N}(\phi \, d_2)$$

$$d_2 = \frac{\ln(S/K) + (r - \frac{1}{2}\sigma^2)T}{\sigma\sqrt{T}}$$

where $\phi = +1$ for a call (YES share) and $\phi = -1$ for a put (NO share).

---

## Greeks

PolyGreeks computes four risk sensitivities for any position. These behave **qualitatively differently** from vanilla options — understanding the differences is the key to using this tool.

| Greek | Binary formula | Key difference from vanilla |
|---|---|---|
| Delta | $\frac{\phi \, e^{-rT} n(d_2)}{S \sigma \sqrt{T}}$ | Bell-shaped (peaks ATM), not monotone |
| Gamma | $-\frac{\phi \, e^{-rT} n(d_2) \, d_1}{S^2 \sigma^2 T}$ | Changes sign at ATM |
| Vega | $-\frac{\phi \, e^{-rT} d_1 \, n(d_2)}{\sigma}$ | Negative for ITM — rising vol hurts you |
| Theta | $e^{-rT}\!\left(\phi \, n(d_2)\frac{d_2}{2T\sigma\sqrt{T}} + r\,\mathcal{N}(\phi d_2)\right)$ | Can be positive for deep ITM positions |

### Greeks cross-sections

Cross-sections of each Greek vs underlying price $S$ and time to expiry $T$, for both binary and vanilla calls/puts. Parameters: $K=100$, $\sigma=0.3$, $r=0.05$, $T=0.5$ fixed for $S$-cross-sections, $S=100$ fixed for $T$-cross-sections.

![Greeks cross-sections: binary vs vanilla](greeks_plots.png)

**What to notice:**

- **Delta**: Binary call delta is bell-shaped and peaks ATM, then collapses. Vanilla delta is a monotone S-curve. As $T \to 0$ ATM, binary delta diverges — making near-expiry contracts extremely difficult to hedge.
- **Gamma**: Binary gamma changes sign at the strike. OTM binary is long gamma (like vanilla), ITM binary is short gamma (unlike vanilla). Vanilla gamma is always positive.
- **Vega**: Binary vega changes sign at ATM. If you hold a deep ITM YES share (say 85% probability), you have *negative* vega — rising volatility in BTC hurts your position by increasing the chance of falling back OTM. Vanilla vega is always positive.
- **Theta**: Deep ITM binary positions have *positive* theta — time passing is good when you're nearly certain to be paid out. This is the basis for the theta-harvesting strategy.

---

## Alpha opportunities

Three distinct strategies emerge from the Greeks framework:

### 1. Probability mispricing
When $|p_{PM} - p_{BS}|$ exceeds transaction cost thresholds (~3–5%), the spread can be captured by:
- Taking the opposing side on Polymarket
- Hedging directional BTC exposure via Deribit options
- Net position: long the probability spread, delta-neutral

### 2. Vega arbitrage
ITM binary contracts have negative vega. If Deribit implied vol is elevated relative to your forecast:
- Buy YES on Polymarket (cheap relative to model)
- Short vega on Deribit to hedge
- Net position: probability-long, vega-neutral

### 3. Theta harvesting
Deep ITM contracts (e.g. 85% probability) have positive theta. Structure:
- Hold YES on Polymarket (collect daily theta)
- Buy OTM puts on Deribit to cap tail risk
- Net position: long theta, bounded downside

The combined Greek P&L equation for a delta-neutral book:

$$d\Pi = \frac{1}{2}\Gamma_{\text{net}}(dS)^2 - \Theta_{\text{net}}\,dt$$

---

## Data sources

| Source | Data | Endpoint |
|---|---|---|
| Polymarket Gamma API | Live market probabilities | `gamma-api.polymarket.com/markets` |
| Polymarket CLOB | Order book depth | `clob.polymarket.com` |
| Deribit REST | Implied vol surface + Greeks | `deribit.com/api/v2/public/get_order_book` |

Deribit vol is interpolated across expiries using variance-linear interpolation to match Polymarket's exact resolution date:

$$\sigma_{\text{interp}} = \sqrt{\frac{T_2 - T}{T_2 - T_1}\sigma_1^2 + \frac{T - T_1}{T_2 - T_1}\sigma_2^2}$$

---

## Features

- **Market scanner** — ranks live Polymarket crypto contracts by $|p_{PM} - p_{BS}|$, largest mispricings first
- **Greeks dashboard** — real-time Delta, Gamma, Vega, Theta for any position size
- **Payoff surface** — 2D P&L surface across probability × time to resolution
- **Hedge calculator** — suggests Deribit options hedge to neutralize delta or vega; shows combined portfolio Greeks
- **Theta harvest analyzer** — computes daily theta income and OTM put hedge cost for ITM positions

---

## Model assumptions

These are stated explicitly so users can reason about model risk:

- Underlying follows Geometric Brownian Motion (fat tails not captured)
- Continuous hedging assumed; transaction costs not modeled
- Oracle/resolution risk not priced (no analog in exchange-traded options)
- Risk-free rate approximated at 5% annualized
- Arbitrage between Polymarket and Deribit assumed possible but not frictionless

A realistic mispricing threshold accounting for these frictions is ~3–5% on $|p_{PM} - p_{BS}|$.

---

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React + Recharts |
| Compute | Python (scipy, numpy) |
| Data | Polymarket Gamma API + Deribit public REST |
| Hosting | Vercel + serverless functions |

---

## References

- Black, F. & Scholes, M. (1973). *The Pricing of Options and Corporate Liabilities*. Journal of Political Economy.
- Reiner, E. & Rubinstein, M. (1991). *Unscrambling the Binary Code*. Risk Magazine.
- QuantPie. *Cash-or-Nothing Options: Greeks Derivation*. [quantpie.co.uk](https://www.quantpie.co.uk/bsm_bin_c_formula/bs_bin_c_summary.php)
- Deribit API Documentation. [docs.deribit.com](https://docs.deribit.com)
- Polymarket Documentation. [docs.polymarket.com](https://docs.polymarket.com)
