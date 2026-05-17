# 💹 McMoney v2.8: The Autonomous Agentic Hedge Fund

> "Architecture is what turns a smart model into a dependable system." — *Dhivya Nagasubramanian (2026)*

McMoney is a professional-grade, goal-driven autonomous trading agent designed for the **Hyperliquid** perpetuals market. It represents a paradigm shift from static algorithmic bots to a high-conviction **Agentic AI** framework, designed to capture unlimited trend upside while enforcing strictly limited, asymmetric downside.

---

## 🧠 The Agentic Core: PER Architecture
McMoney is built on the **Planner-Executor-Reflector (PER)** loop, a cognitive architecture that ensures the system remains goal-oriented and adaptive rather than script-driven.

- **Planner**: Decomposes the macro goal ("Maximize BTC Trend Alpha") into actionable subgoals. It synthesizes market context, order flow imbalance, and sentiment to tune strategy parameters in real-time.
- **Executor**: The deterministic "hands" of the system. It uses a high-conviction quantitative engine (SMA Regime Filters + Donchian Breakouts) to place orders and manage positions.
- **Reflector**: A critical feedback loop that observes execution outcomes, updates the agent's **Episodic Memory**, and refines its **Semantic Knowledge** for the next cycle.

---

## 🔬 Strategy & Microstructure Edge
Designed by the "Jules" persona—an elite quantitative strategist with 20+ years of institutional experience—the system utilizes two primary pillars of alpha:

1. **Asymmetric Trend Following**:
   - **Regime Detection**: 200-period SMA slope filter + 50/200 SMA golden cross detection.
   - **Momentum Entry**: 20-period Donchian Channel High breakouts on the 4H timeframe.
   - **The "Ratchet" Exit**: A pure Chandelier Exit (ATR x 3.0) trailing stop that locks in profits while allowing for parabolic runs. No fixed take-profits.

2. **Market Microstructure Awareness**:
   - **Order Book Imbalance (OBI)**: Real-time analysis of the L2 Order Book depth. Trades are only executed when OBI confirms significant buy/sell pressure (>30% imbalance).

---

## 🛡️ Institutional-Grade Risk Guardrails
Safety is enforced at the **infrastructure level**, outside the influence of the LLM reasoning engine:
- **Hard Tool Contracts**: Strict schema validation for all exchange API calls.
- **MAX_RISK_PCT**: A non-negotiable hard limit of 2.0% equity risk per trade.
- **Circuit Breakers**: Immediate halt on daily drawdown limits (>5%) or consecutive execution failures.
- **Reduce-Only Trigger Orders**: All stop-losses are placed as native trigger orders on Hyperliquid to prevent "fat-finger" or manual execution errors.

---

## 🛠️ Technical Stack
- **Engine**: Python 3.11 (Asyncio)
- **Intelligence**: OpenAI GPT-4o-mini / Claude 3 Haiku
- **Execution**: Hyperliquid Python SDK (Testnet)
- **Control**: Async Telegram Bot (v20)
- **Deployment**: Docker + Railway (One-Click)
- **State**: Persistent Memory (Episodic + Semantic JSON storage)

---

## 📖 System Documentation
- [**Full System Specification**](DOCUMENTATION.md) — Architecture, Memory, and Tech Stack.
- [**Alpha Roadmap**](ALPHA_ROADMAP.md) — The path from retail bot to a $100M+ AUM Institutional Fund.
- [**Strategy Report**](STRATEGY_REPORT.md) — Detailed quantitative formulas and OBI implementation.

---

## 🚀 Deployment in 5 Minutes
1. **Clone** the repository.
2. **Fill** the `.env` file with your Telegram and Hyperliquid keys (use `.env.example` as a template).
3. **Deploy**: Run `docker-compose up --build` or deploy directly to **Railway**.
4. **Command**: Use `/status` in Telegram to watch your agent begin its first PER cycle.

---
*Disclaimer: This is research software. Trading involves significant risk. Use only on Testnet until you have verified the strategy through 3-6 months of paper trading.*
