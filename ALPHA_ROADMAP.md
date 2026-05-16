# ALPHA ROADMAP: The Path to Market Dominance

## 1. The Core Problem: The "Static Decay"
Most trading bots lose because their parameters are static. The market's volatility regime changes weekly, making static rules obsolete.

## 2. The Solution: McMoney v2.8 Agentic Core
We have implemented a robust agentic architecture inspired by *Architecting Goal-Driven Systems* (2026).

### Tier 1: Deterministic Guardrails (The Shield)
- **Hard Tool Contracts**: Validated schemas and "outside the model" risk limits.
- **Circuit Breakers**: Halts on daily drawdown or consecutive execution failures.
- **Rachet Trailing Stops**: Real-time stop-loss management.

### Tier 2: Agentic Meta-Layer (The Brain)
- **Planner-Executor-Reflector (PER) Loop**: Decomposes goals into planned steps, executes via tools, and reflects on outcomes.
- **Memory Architecture**:
  - **Short-term**: Current context.
  - **Episodic**: Log of past trades and their outcomes.
  - **Semantic**: Verified market facts and domain knowledge.
- **Dynamic Tuning**: AI adjusts ATR multipliers and risk percentages.

### Tier 3: World-Class R&D (The Vision)
1. **Proprietary Data**: Order book imbalance (OBI) and microstructure signals.
2. **Infrastructure**: VPS co-location (<1ms).
3. **Neuro-Symbolic Hybrid**: Combining RL with symbolic risk reasoning.

## 3. roadmap to v3.0
- [x] v2.7: Microstructure (OBI) & Confirmation Filters.
- [x] v2.8: **Planner-Executor-Reflector Loop & Memory Architecture**.
- [ ] v2.9: **Websocket-based OBI & Real-time Context Feeding**.
- [ ] v3.0: **Full Neuro-Symbolic Institutional Fund**.
