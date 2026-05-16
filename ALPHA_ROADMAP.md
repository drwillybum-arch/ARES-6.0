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
- **Signal Compression**: Token-efficient JSON feeds.
- **Short-Term Memory**: The LLM remembers its recent decisions.
- **Dynamic Tuning**: AI adjusts ATR multipliers, risk percentages, and breakout windows live.

### Tier 3: World-Class R&D (The Vision)
To achieve world-class status (Sharpe > 1.5, $100M+ AUM), we are moving toward:
1. **Proprietary Data**: Integrating order book depth and historical tick data.
2. **Infrastructure**: Moving toward VPS co-location (<1ms from exchange matching).
3. **Neuro-Symbolic Agents**: Combining RL for execution with symbolic reasoning for risk.
4. **Order Flow Imbalance (OBI)**: Decoding hidden liquidity and detecting iceberg orders.
5. **Real-time VaR**: Recalculating Value-at-Risk every millisecond.

## 3. "Stolen" Best Practices
- **Hummingbot-style Gateway**: Centralized `MarketContextServer`.
- **FreqAI-style Adaptation**: Dynamic `tuning` parameters.
- **FinRobot-style Multi-Agent**: Specialized prompt roles.

## 4. Roadmap to v3.0 (The Institution)
- [x] v2.5: Agentic Parameter Optimization.
- [x] v2.6: MCP Context Server & Signal Compression.
- [x] v2.7: **Order Flow Imbalance (OBI) & Market Microstructure**.
- [ ] v2.8: **Co-located Low-Latency Execution & VPS Migration**.
- [ ] v3.0: **Full Neuro-Symbolic Autonomy**.
