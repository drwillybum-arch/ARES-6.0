# ALPHA ROADMAP: The Path to Market Dominance

## 1. The Core Problem: The "Static Decay"
Most trading bots lose because their parameters are static. The market's volatility regime changes weekly, making static rules obsolete.

## 2. The Solution: McMoney v2.6 Agentic Core
We have implemented a three-tier architecture inspired by top open-source bots (Freqtrade, Hummingbot) and agentic research (FinRobot).

### Tier 1: Deterministic Guardrails (The Shield)
- **Hyperliquid Execution**: Fast, low-fee, native MEV protection.
- **Rachet Trailing Stops**: Real-time stop-loss management based on volatility.
- **Circuit Breakers**: Daily drawdown limits enforced by exchange balance.

### Tier 2: Agentic Meta-Layer (The Brain)
- **MCP Context Server**: Centralized aggregator of technicals, macro, and news.
- **Signal Compression**: Token-efficient JSON feeds that provide the LLM with maximum info in minimum context.
- **Short-Term Memory**: The LLM remembers its recent decisions to avoid flip-flopping.
- **Dynamic Tuning**: AI adjusts ATR multipliers, risk percentages, and breakout windows live.

### Tier 3: Cross-Asset Correlation (The Edge)
- **Macro Overlay**: Monitoring SPY, DXY, and US10Y to identify crypto-friendly regimes.
- **Sentiment Weighting**: (Roadmap) Integrating LunarCrush and Santiment APIs.

## 3. "Stolen" Best Practices
- **Hummingbot-style Gateway**: Centralized `MarketContextServer`.
- **FreqAI-style Adaptation**: Dynamic `tuning` parameters from the LLM.
- **FinRobot-style Multi-Agent**: Specialized prompt roles for different market analysis.

## 4. Roadmap to v3.0
- [x] v2.5: **Agentic Parameter Optimization**.
- [x] v2.6: **MCP Context Server & Signal Compression**.
- [ ] v2.7: **Backtesting Hook Integration** (Jesse-style).
- [ ] v3.0: **Full Strategy Evolution** (AI proposes and tests new code).
