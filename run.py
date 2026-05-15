import asyncio
import os
import signal
from datetime import datetime
from dotenv import load_dotenv

from strategies.deterministic_engine import DeterministicEngine
from utils.hyperliquid_client import HyperliquidTestnet
from utils.telegram_bot import TelegramBot
from advisors.llm_client import LLMAdvisor
from utils.logger import HedgeFundLogger

load_dotenv()

class AutonomousHedgeFund:
    def __init__(self):
        self.engine = DeterministicEngine()
        self.exchange = HyperliquidTestnet()
        self.telegram = TelegramBot()
        self.advisor = LLMAdvisor()
        self.logger = HedgeFundLogger()
        self.is_paused = False
        self.daily_start_balance = None
        self.daily_loss_limit = float(os.getenv("DAILY_LOSS_LIMIT_PCT", 5))
        self.hourly_reports = []

    async def check_daily_loss(self):
        """Fetch current balance from Hyperliquid testnet"""
        current_balance = await self.exchange.get_wallet_balance()
        if self.daily_start_balance is None:
            self.daily_start_balance = current_balance
            return False
        daily_loss_pct = (self.daily_start_balance - current_balance) / self.daily_start_balance * 100
        if daily_loss_pct > self.daily_loss_limit:
            await self.telegram.send_message(f"⚠️ Daily loss limit reached: {daily_loss_pct:.2f}% > {self.daily_loss_limit}%. Halting.")
            return True
        return False

    async def handle_daily_report(self):
        """Send a daily aggregate report to Telegram at 00:00 UTC"""
        now = datetime.utcnow()
        if now.hour == 0 and self.hourly_reports:
            report = await self.advisor.generate_daily_report(self.hourly_reports)
            await self.telegram.send_message(f"📋 *Daily Market Report*\n\n{report}")
            self.hourly_reports = [] # Reset for the next day
            self.daily_start_balance = await self.exchange.get_wallet_balance() # Reset daily baseline

    async def run(self):
        # Start Telegram bot in background
        asyncio.create_task(self.telegram.run(self))

        print("McMoney Autonomous Hedge Fund started.")
        if self.exchange.dry_run:
            print("RUNNING IN DRY_RUN MODE - No real trades will be executed.")

        # Main trading loop (every hour)
        while True:
            if not self.is_paused:
                # Check daily loss first
                if await self.check_daily_loss():
                    self.is_paused = True
                    continue

                # Get deterministic signal
                decision = await self.engine.decide()

                # Prepare market data for advisor
                price = await self.exchange.get_mid_price("BTC")
                market_data = {"price": price, "strategy_decision": decision}

                # Run LLM advisors (non-blocking, for logging only)
                advisor_report = await self.advisor.analyze(market_data=market_data)
                self.hourly_reports.append(advisor_report)
                await self.logger.log_advisor_report(advisor_report)

                if decision["action"] in ["long", "short"]:
                    # Execute trade on testnet
                    order = await self.exchange.place_order(
                        symbol="BTC-USDT",
                        side=decision["action"],
                        size_pct=decision["size_pct"],
                        stop_loss=decision.get("stop_loss"),
                        take_profit=decision.get("take_profit")
                    )
                    await self.logger.log_trade(decision, order)
                    await self.telegram.send_message(
                        f"🔄 Auto trade executed: {decision['action'].upper()} {decision['size_pct']}% at {datetime.utcnow()}\n"
                        f"Price: {order.get('price')} | Stop: {decision.get('stop_loss')} | TP: {decision.get('take_profit')}"
                    )
                else:
                    # Log hold decision
                    await self.logger.log_hold(decision)

                # Check if it's time for the daily report
                await self.handle_daily_report()

            # Wait 1 hour, but check for pause every 10 seconds
            for _ in range(360):
                await asyncio.sleep(10)
                if self.is_paused:
                    continue

    def pause(self, *args):
        self.is_paused = True
        print("Trading paused.")

    def resume(self):
        self.is_paused = False
        self.daily_start_balance = None
        print("Trading resumed.")

if __name__ == "__main__":
    fund = AutonomousHedgeFund()
    loop = asyncio.get_event_loop()

    try:
        # Fixed signal handler signature compatibility
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, fund.pause)
    except NotImplementedError:
        pass

    loop.run_until_complete(fund.run())
