# McMoney v2.8: The Goal-Driven Autonomous Hedge Fund

McMoney is an autonomous agentic hedge fund built on the principles of goal-driven autonomy. It replaces static bot scripts with a robust **Planner-Executor-Reflector (PER)** architecture, trading perpetuals on Hyperliquid.

## 🚀 Key Features
- **Goal-Driven Autonomy**: Moves from "how" (scripts) to "what" (objectives).
- **PER Architecture**: Planning, Execution, and Reflection in every cycle.
- **Memory System**: Episodic and Semantic memory for continuous adaptation.
- **Microstructure-Aware**: Order Book Imbalance (OBI) confirmation filters.
- **Professional Risk Management**: ATR trailing stops, daily drawdown limits, and hard-coded tool guardrails.

## 🧠 System Overview
- **Brain**: LLM-based reasoning for dynamic parameter tuning (advisors/).
- **Execution Engine**: Deterministic trend-following and OBI logic (strategies/).
- **Context Server**: Token-efficient data aggregation (utils/context_server.py).
- **Communication**: Full Telegram bot control interface (utils/telegram_bot.py).

## 🛠️ Getting Started
1. **Setup**: `pip install -r requirements.txt`
2. **Configure**: Fill `.env` with Telegram and Hyperliquid keys.
3. **Deploy**: `docker-compose up --build` or one-click to Railway.

## 📖 Detailed Documentation
- [Full System Documentation](DOCUMENTATION.md) - Architecture, Tech Stack, and Safety.
- [Alpha Roadmap](ALPHA_ROADMAP.md) - The path to world-class trading.
- [Strategy Report](STRATEGY_REPORT.md) - Quantitative logic and OBI formulas.

---
*Built on the principles of Dhivya Nagasubramanian (2026).*
