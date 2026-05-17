# 💹 McMoney: Professional Autonomous Trading Machine

McMoney is a high-conviction, autonomous trading platform designed for **Hyperliquid** perpetuals. Built with elite quantitative logic (The "Jules" Persona), it navigates crypto markets 24/7 to capture unlimited trend upside while enforcing institutional-grade risk management.

---

## ⚡ Core Alpha: High-Frequency Microstructure
Unlike standard retail bots, McMoney uses professional-grade data analysis to ensure every trade has an edge:

- **Proprietary Quant Logic**: Derived from 20+ years of institutional experience.
- **Microstructure Awareness**: Real-time **Order Book Imbalance (OBI)** filtering to decode hidden liquidity and avoid bull traps.
- **Asymmetric Risk**: A pure Chandelier "Ratchet" stop system. We never take profit early; we let the market parabolic runs play out.
- **Macro Filters**: Strict 200 SMA regime detection to stay out of chop and bear markets.

---

## 🛠️ The Machine Architecture
The bot operates on a continuous loop, orchestrating intelligence and execution:

| Module | Function |
|-----------|-------------|
| **Execution Engine** | High-speed Hyperliquid integration for Orders & Stops. |
| **Strategy Core** | Donchian Breakouts + SMA Regime + OBI Microstructure. |
| **AI Advisor** | GPT-4o / Claude 3 dynamically tuning ATR and Risk live. |
| **Memory System** | Episodic and Semantic history for continuous learning. |

---

## 🚀 One-Click Deployment
1. **Clone** the repo: `git clone <repo-url>`
2. **Setup**: `pip install -r requirements.txt`
3. **Configure**: Fill `.env` with your Hyperliquid and Telegram keys.
4. **Deploy**: Use `docker-compose up` or push to **Railway**.
5. **Control**: Use Telegram commands (`/status`, `/pause`) to monitor your machine.

---

## 📖 Complete Documentation Index
Looking for the details? Everything is organized in the [**docs/**](docs/) folder:

- 🔭 [**System Vision**](docs/VISION.md) — Philosophy and the 'Jules' persona.
- 🛠️ [**Setup Guide**](docs/GUIDE.md) — Detailed deployment and Telegram instructions.
- 📈 [**Trading Rules**](docs/TRADING_RULES.md) — Quantitative formulas and OBI logic.
- 🤖 [**AI Bot Rules**](docs/AGENT_RULES.md) — Planner-Executor loop and Memory architecture.
- 📜 [**Devlog**](docs/DEVLOG.md) — Historical evolution of the platform.
- 🚀 [**Roadmap**](docs/VERSIONS.md) — Path to v3.0 institutional status.

---
*Disclaimer: Trading involves significant risk. Start on Testnet.*
