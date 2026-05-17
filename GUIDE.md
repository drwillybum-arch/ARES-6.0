# McMoney User Guide: Deployment & Control

## 1. Prerequisites
- **Hyperliquid Testnet**: API Wallet Address and Private Key.
- **Telegram**: A bot token from [@BotFather](https://t.me/botfather).
- **Python 3.11+**: If running locally without Docker.

## 2. Environment Configuration
Copy `.env.example` to `.env` and configure the following:
- `TELEGRAM_BOT_TOKEN`: Your bot's API token.
- `TELEGRAM_USERID`: Your numeric Telegram ID (the only user authorized to control the bot).
- `HYPERLIQUID_TESTNET_WALLET`: Your 0x... address.
- `HYPERLIQUID_TESTNET_PRIVATE_KEY`: Your private key (keep this secret!).
- `DRY_RUN`: Set to `false` for real testnet execution.

## 3. Deployment

### A. One-Click Railway
1. Push this repository to GitHub.
2. Link your Railway account and select "Deploy from GitHub."
3. Set your environment variables in the Railway dashboard.
4. The bot will automatically start the main loop.

### B. Docker Compose
```bash
docker-compose up --build -d
```

## 4. Telegram Commands
- `/status`: Get current account value, open positions, and current AI tuning parameters.
- `/pause`: Halts the autonomous loop immediately.
- `/resume`: Resets failure counters and resumes the PER cycle.

## 5. Monitoring Logs
Trade data and advisor reports are stored in the `/app/data` directory as CSV and JSON files. In Railway, ensure a Volume is attached to this directory for persistence.
