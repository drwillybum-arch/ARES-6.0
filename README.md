# McMoney v2.5: The Agentic AI Fund

McMoney is no longer just a trading bot; it is an **Autonomous Agentic Hedge Fund**. It bridges deterministic quantitative execution with LLM-powered reasoning to achieve a sustainable market edge.

## 🚀 The AI "Win": Agentic Meta-Optimization
Unlike static bots that decay as market regimes change, McMoney uses an LLM-Agentic layer to:
1. **Analyze Volatility**: Adjusts ATR multipliers live to avoid being "stopped out" during fake-outs.
2. **Gauge Sentiment**: Scales risk up/down based on macro sentiment and news.
3. **Optimize Entries**: Dynamically tunes breakout windows to match the current trend speed.

## 🧠 Architecture
- **Deterministic Core**: ATR Trailing Stops, 200 SMA Regime Filter, Donchian Breakouts.
- **Agentic Brain**: GPT-4o-mini / Claude 3 Haiku providing hourly parameter tuning.
- **Execution**: Hyperliquid Testnet (High-speed, low-fee).

## 📊 Strategy: Asymmetric Trend Capture
- **Upside**: Unlimited. We ratchet stops higher but never set take-profits.
- **Downside**: Strictly limited by Chandelier Exit (ATR-based) and a 4-5% daily drawdown circuit breaker.

## 🛠️ Getting Started
1. **Setup**: `pip install -r requirements.txt`
2. **Configure**: Fill `.env` with Telegram and Hyperliquid keys.
3. **Deploy**: `docker-compose up --build` or deploy one-click to Railway.

## 📈 Roadmap
- **v2.0**: Professional Trend-Following.
- **v2.5**: **Agentic Parameter Optimization** (Current).
- **v3.0**: Multi-Agent Factor Discovery & Portfolio Rebalancing.
