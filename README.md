# McMoney v2.8: The Goal-Driven Autonomous Agent

McMoney v2.8 is an **Autonomous Agentic Hedge Fund** built on the principles of goal-driven autonomy. It replaces static bot scripts with a robust Planner-Executor-Reflector (PER) architecture.

## 🚀 Key Features: Autonomy Mindset
- **Goal-Driven**: Moves from "how" (scripts) to "what" (objectives). The agent plans its own path based on the market regime.
- **PER Architecture**: Every hourly cycle involves a formal Plan, Execution via strict tools, and Reflection on the outcome to improve future decisions.
- **Memory Architecture**: Persistent episodic and semantic memory allows the bot to "learn" from past trades and store verified market facts.
- **Microstructure-Aware**: Uses Order Book Imbalance (OBI) to confirm high-conviction trend entries.

## 🧠 Core Building Blocks
- **Planner**: LLM-based reasoning engine that tunes parameters and analyzes context.
- **Executor**: Deterministic engine for order execution and position management.
- **Reflector**: Feedback loop that updates episodic memory with trade results.
- **Guardrails**: Hard-coded risk limits (MAX_RISK_PCT) and circuit breakers (drawdown + failure count) that live outside the model's influence.

## 🛠️ Getting Started
1. **Setup**: `pip install -r requirements.txt`
2. **Configure**: Fill `.env` with Telegram and Hyperliquid keys.
3. **Deploy**: `docker-compose up --build` or one-click to Railway.

## 📈 Roadmap
- **v2.0**: Professional Trend-Following.
- **v2.7**: Microstructure (OBI).
- **v2.8**: **Planner-Executor-Reflector (PER) Loop & Memory** (Current).
- **v3.0**: Full Neuro-Symbolic Autonomy.
