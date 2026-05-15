# McMoney: Autonomous Agentic Hedge Fund

Fully automatic trading bot for Hyperliquid testnet with LLM advisors.

## Features
- **Deterministic Engine**: Funding Arbitrage and Trend Following strategies.
- **LLM Advisors**: Hourly analysis from multiple specialized agents (Finance Manager, Technical Analyst, Macro Analyst, etc.).
- **Daily Reporting**: Aggregated market summaries sent to Telegram at 00:00 UTC.
- **Risk Management**: Automated daily loss limit halting based on actual exchange balance.
- **Telegram Control**: Monitor and control via `/status`, `/pause`, and `/resume`.

## Setup
1. Clone the repo.
2. Copy `.env.example` to `.env` and fill in your keys.
3. Deploy to Railway or run via Docker:
   ```bash
   docker-compose up --build
   ```

## Requirements
- Python 3.11+
- Hyperliquid Testnet Account
- Telegram Bot Token
- OpenAI or Anthropic API Key (Optional)
