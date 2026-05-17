# 💹 McMoney v2.8: The Autonomous Agentic Hedge Fund

> "Architecture is what turns a smart model into a dependable system." — *Dhivya Nagasubramanian (2026)*

McMoney is a professional-grade, goal-driven autonomous trading agent designed for the **Hyperliquid** perpetuals market. It represents a paradigm shift from static algorithmic bots to a high-conviction **Agentic AI** framework, designed to capture unlimited trend upside while enforcing strictly limited, asymmetric downside.

---

## 🧠 System Summary
McMoney operates on a **Planner-Executor-Reflector (PER)** loop, a cognitive architecture that ensures the system remains goal-oriented and adaptive. It combines institutional quantitative logic (The "Jules" Persona) with real-time market microstructure analysis.

| Component | Description |
|-----------|-------------|
| **Architecture** | Goal-driven PER loop with Episodic & Semantic Memory. |
| **Strategy** | 200 SMA Regime Filter + Donchian Breakouts + OBI Confirmation. |
| **Risk** | ATR-based "Ratchet" stops + Hard-coded safety circuit breakers. |
| **AI Layer** | GPT-4o / Claude 3 performing hourly parameter optimization. |
| **Execution** | Hyperliquid Python SDK (Testnet) with reduce-only trigger safety. |

---

## 📖 Documentation Index
For a deep dive into every aspect of the system, please refer to the following:

- 🔭 [**Vision & Philosophy**](VISION.md) — The "Jules" persona and the core "Asymmetric Dominance" philosophy.
- 🛠️ [**User Guide**](GUIDE.md) — Deployment instructions for Railway/Docker and Telegram control commands.
- 📈 [**Trading Rules**](TRADING_RULES.md) — Deep dive into the SMA filters, breakout logic, and OBI formulas.
- 🤖 [**Agent Rules**](AGENT_RULES.md) — Explanation of the PER loop, Memory Architecture, and Infrastructure Guardrails.
- 📜 [**Devlog**](DEVLOG.md) — The historical evolution of the project from a script to an agent.
- 🚀 [**Versions & Roadmap**](VERSIONS.md) — Technical history and the path to v3.0 institutional status.

---

## 🚀 Quick Start
1. **Clone** the repo and `pip install -r requirements.txt`.
2. **Configure** `.env` with your Hyperliquid and Telegram keys.
3. **Deploy** via `docker-compose up` or one-click to **Railway**.
4. **Interact** via Telegram using `/status` to watch the agent begin its first cycle.

---
*Disclaimer: This is research software. Trading involves significant risk. Use only on Testnet until you have verified the strategy through 3-6 months of paper trading.*
