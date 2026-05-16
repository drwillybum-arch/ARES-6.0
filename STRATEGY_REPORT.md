# McMoney v2.7: The Microstructure-Aware AI Fund

## 1. Executive Summary
McMoney v2.7 introduces **Market Microstructure Analysis** through Order Book Imbalance (OBI). It now moves from simple trend-following to a multi-stage execution model that requires order-flow confirmation for all high-conviction trades.

## 2. World-Class Regime Detection
- **Macro**: Price > 200 SMA (Daily) + 50 SMA > 200 SMA.
- **Microstructure**: Order Book Imbalance (OBI) > 0.3 for Longs, < -0.3 for Shorts.
- **Symbolic Layer**: LLM Advisor provides a symbolic overlay to detect "Bull Traps" or "Liquidity Grabs" by analyzing OBI vs Price Action.

## 3. Order Flow Imbalance (OBI) Logic
We analyze the top 5 levels of the L2 Order Book:
`OBI = (Bid Volume - Ask Volume) / (Bid Volume + Ask Volume)`
A high OBI indicates significant hidden buy pressure, acting as a "lead indicator" for immediate price direction.

## 4. Neuro-Symbolic Architecture
- **Neuro**: RL-inspired parameter tuning (via LLM).
- **Symbolic**: Deterministic trend rules + microstructure filters.
This hybrid approach mimics institutional desks by combining high-speed rules with adaptive, qualitative reasoning.

## 5. Strategy Parameters
| Parameter | Value |
|-----------|-------|
| OBI Threshold | 0.3 (30% imbalance) |
| Risk Per Trade | 0.5% of Equity |
| Stop Loss | ATR x 3.0 (Chandelier Exit) |
| Max Leverge | 3x - 5x (Target) |

## 6. Deployment Roadmap
- [x] v2.6: Agentic Context Aggregation.
- [x] v2.7: **Microstructure (OBI) & Confirmation Filters**.
- [ ] v2.8: **Websocket-based OBI Tracking (Low Latency)**.
- [ ] v3.0: **Full Neuro-Symbolic Institutional Fund**.
