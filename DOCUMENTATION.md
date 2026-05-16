# McMoney v2.8: Complete System Documentation

McMoney is a professional-grade, autonomous agentic hedge fund designed for the Hyperliquid perpetuals market. It combines high-fidelity quantitative strategies with a state-of-the-art agentic reasoning framework (Planner-Executor-Reflector).

---

## 1. Technical Stack
- **Core Language**: Python 3.11
- **Execution Interface**: `hyperliquid-python-sdk`
- **Agent Intelligence**: OpenAI GPT-4o-mini / Claude 3 Haiku (Configurable)
- **Data Processing**: Pandas, NumPy
- **Communication**: `python-telegram-bot` (Async v20)
- **Deployment**: Docker, Docker Compose, Railway (One-Click)
- **Environment**: Linux-based (containerized)

---

## 2. System Architecture: The "Agentic Heartbeat"
McMoney operates on a **Planner-Executor-Reflector (PER)** loop, running at 1-hour intervals.

### A. Planner (advisors/llm_client.py)
The Planner is the reasoning engine. It:
1. Ingests a **Compressed Context Feed** from the `MarketContextServer`.
2. Analyzes short-term **Episodic Memory** (recent outcomes).
3. Recommends dynamic trading parameters: `atr_multiplier`, `risk_pct`, and `breakout_window`.

### B. Executor (run.py + strategies/)
The Executor is the deterministic "hands" of the agent.
1. **Trend Strategy**: Uses 200 SMA regime detection and Donchian breakouts.
2. **Microstructure Filter**: Uses **Order Book Imbalance (OBI)** to confirm entries.
3. **Execution**: Places Market Orders and Trigger-based Stop-Loss orders on Hyperliquid.

### C. Reflector (utils/memory.py)
The Reflector closes the loop.
1. Observes the outcome of the Executor's actions.
2. Updates **Episodic Memory** with the event and outcome.
3. Updates **Semantic Memory** with verified market facts.

---

## 3. Strategy Logic

### Trend Following (strategies/trend_following.py)
- **Regime**: Longs only if `Price > 200 SMA` and `50 SMA > 200 SMA`.
- **Entry**: Price breaks the 20-period High on the 4H timeframe.
- **Exit**: ATR-based trailing stop (Chandelier Exit).

### Order Book Imbalance (strategies/order_flow.py)
- Analyzes the top 5 levels of the L2 order book.
- `OBI = (Bid Volume - Ask Volume) / (Bid Volume + Ask Volume)`
- Requires `|OBI| > 0.3` to confirm any trade entry.

---

## 4. Memory Architecture
McMoney uses a persistent multi-tier memory system:
- **Short-term (Working)**: Volatile context for the current run.
- **Long-term (Episodic)**: Persistent JSON log of the last 100 trade events and outcomes.
- **Long-term (Semantic)**: Persistent storage of verified facts (e.g., "OBI confirmed the last 3 breakouts").

---

## 5. Safety & Risk Guardrails
Safety is enforced at the infrastructure level, outside the model's reasoning:
- **MAX_RISK_PCT**: Hard limit of 2.0% equity risk per trade.
- **Daily Loss Limit**: Circuit breaker that halts the bot if account value drops > 5% in 24h.
- **Failure Circuit Breaker**: Halts if 5 consecutive execution errors occur.
- **Dry Run Mode**: Default mode that simulates trades for safe testing.
- **Reduce-Only**: All stop-loss orders are marked as `reduce_only` to prevent unintended position opening.

---

## 6. Communication & Control (Telegram)
- **/status**: Returns current equity, active positions, and AI parameter tuning.
- **/pause**: Immediate kill switch to stop all autonomous trading.
- **/resume**: Resets circuit breakers and resumes the PER loop.
- **Notifications**: Real-time alerts for "Ratchet" stop movements and trade entries.

---

## 7. Deployment Guide
1. **GitHub**: Push all files to a private repository.
2. **Railway**: Link the repo and set environment variables:
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_USERID`
   - `HYPERLIQUID_TESTNET_WALLET`, `HYPERLIQUID_TESTNET_PRIVATE_KEY`
   - `OPENAI_API_KEY`, `DRY_RUN=false`
3. **Monitor**: Watch the logs or Telegram for the "Master-Class" activation.
