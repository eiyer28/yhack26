================================================================================
POLYGREEKS — PRODUCT SPECIFICATION
Prediction Market Risk Analytics via Binary Options Framework
================================================================================

EXECUTIVE SUMMARY
-----------------

PolyGreeks is a real-time analytics tool that bridges prediction markets and
traditional derivatives pricing. It prices Polymarket crypto contracts as
cash-or-nothing binary options using implied volatility sourced from Deribit,
computes Greeks for any hypothetical position, and surfaces the spread between
Polymarket's crowd-implied probability and the model-implied probability. The
core insight is that this spread represents a measurable, hedgeable mispricing —
and the Greeks tell you exactly how to hedge it. The tool is aimed at
quantitatively sophisticated traders who want TradFi-style risk intuition applied
to prediction markets.

================================================================================

1. PROBLEM
----------
Polymarket prices are opaque to traders with a TradFi background. There is no
native concept of Greeks, no implied vol, no payoff surface, and no mechanism
for comparing a prediction market price against a model-derived fair value.
Traders cannot reason about time decay, convexity, or volatility sensitivity
the way they would with options. This creates both a usability gap and a
potential mispricing opportunity that goes systematically unexploited. 

Additionally, these contracts behave completely different from normal options, so new analysis is required to gain intuition about the concepts. 

================================================================================

2. SOLUTION
-----------
PolyGreeks treats every Polymarket crypto contract as a cash-or-nothing binary
option on the underlying asset (BTC, ETH, etc.). It sources implied volatility
from Deribit's public API, computes a model probability using the binary
Black-Scholes formula, and compares it against the live Polymarket price.
The spread between the two probabilities is the inefficiency signal.

For any position the user constructs, the tool computes:
  - Delta     (sensitivity to underlying price move)
  - Gamma     (rate of change of delta; sign flips at ATM)
  - Theta     (time decay; can be positive for deep ITM contracts)
  - Vega      (vol sensitivity; negative for ITM contracts)

These are displayed alongside a 2D payoff surface (probability x time) and a
live spread chart showing historical divergence between p_PM and p_BS.

================================================================================

3. DATA SOURCES
---------------
Polymarket (live)
  - Market probabilities and order book via Gamma API and CLOB endpoints
  - Historical probability paths for past resolved contracts
  - Endpoint: https://gamma-api.polymarket.com/markets

Deribit (live)
  - Implied vol surface for BTC and ETH options
  - Greeks served directly (delta, gamma, vega, theta per instrument)
  - Endpoint: https://www.deribit.com/api/v2/public/get_order_book
  - Vol interpolation across expiries to match Polymarket resolution date

================================================================================

4. CORE FEATURES
----------------

4.1  Market Selector
     User searches for a Polymarket crypto contract (e.g. "BTC > $80k by
     June 27"). Tool automatically identifies the underlying asset, strike,
     and resolution date.

4.2  Model Probability vs Market Probability
     Displays p_BS (binary Black-Scholes using Deribit vol) alongside p_PM
     (live Polymarket price). Spread shown numerically and historically.
     Flags contracts where |p_PM - p_BS| exceeds a user-defined threshold.

4.3  Greeks Dashboard
     For a user-specified position size, displays Delta, Gamma, Theta, Vega
     with plain-language interpretations. Updates in real time as market
     prices move.

4.4  Payoff Surface
     2D visualization of position P&L across:
       - X axis: probability at resolution (0 to 1)
       - Y axis: days remaining to resolution
     Contour lines show breakeven and target return levels.

4.5  Hedge Calculator
     Given a Polymarket position, suggests a Deribit options hedge to
     neutralize delta or vega exposure. Shows the combined Greeks of the
     hedged portfolio and the residual theta/gamma position being harvested.

4.6  Theta Harvest Analyzer
     For ITM contracts (positive theta), computes the theoretical daily theta
     income and the cost of an OTM put hedge on Deribit to cap tail risk.
     Shows breakeven holding period.

================================================================================

5. PRICING MODEL
----------------
Binary call price:
  V = e^(-rT) * N(d2)

  d2 = [ ln(S/K) + (r - 0.5*sigma^2)*T ] / (sigma * sqrt(T))

Where:
  S     = current underlying price (BTC/ETH spot)
  K     = strike (threshold in Polymarket contract)
  T     = time to resolution in years
  r     = risk-free rate (approximated at 5% annualized)
  sigma = implied vol interpolated from Deribit surface

Vol interpolation across expiries uses variance-linear interpolation:
  sigma_interp = sqrt( w1*sigma1^2 + w2*sigma2^2 )
  where weights w1, w2 are time-proportional.

Assumptions made explicit in UI:
  - Continuous hedging assumed; transaction costs not modeled
  - Oracle/resolution risk not priced
  - GBM assumed for underlying; fat tails not captured
  - Arbitrage between venues assumed possible but not frictionless

================================================================================

6. USER FLOW
------------
1. User lands on dashboard, sees top Polymarket crypto contracts ranked by
   spread magnitude (|p_PM - p_BS|)
2. User selects a contract, sees model vs market probability, Greeks, and
   payoff surface
3. User inputs a position size and sees their specific risk metrics
4. User optionally runs the hedge calculator to see a delta- or vega-neutral
   combined position
5. User can toggle to historical view to see how the spread has evolved
   for similar past contracts

================================================================================

7. TECH STACK
-------------
Frontend:   React + Recharts for payoff surface and Greeks visualizations
Backend:    Node.js / Python service for Greeks computation and vol interpolation
Data:       Polymarket Gamma API + Deribit public REST API (no auth required)
Hosting:    Vercel (frontend) + lightweight serverless functions for compute

================================================================================

8. EVALUATION CRITERIA ALIGNMENT
----------------------------------
Quality of modeling      Principled binary BS model, Deribit vol surface,
                         variance-linear interpolation, explicit assumptions

Visualization / UX       Payoff surface, live Greeks dashboard, spread chart,
                         hedge calculator with combined portfolio view

Technical depth          Multi-source data pipeline, vol interpolation,
                         cross-market Greeks aggregation

Real-world applicability Identifies actionable mispricings, suggests hedges,
                         quantifies theta harvest opportunities

Creativity               Novel application of binary options Greeks to
                         prediction markets; no existing tool does this

================================================================================