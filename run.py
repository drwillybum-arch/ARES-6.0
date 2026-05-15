import asyncio
import os
import signal
import json
from datetime import datetime
from dotenv import load_dotenv

from strategies.deterministic_engine import DeterministicEngine
from strategies.trend_following import get_trailing_stop
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
        self.state_file = os.path.join(os.getenv("LOG_DIR", "/app/data"), "state.json")
        self.active_stops = self._load_state()

    def _load_state(self):
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, 'r') as f:
                    return json.load(f)
            except: pass
        return {}

    def _save_state(self):
        try:
            with open(self.state_file, 'w') as f:
                json.dump(self.active_stops, f)
        except: pass

    async def check_daily_loss(self):
        current_balance = await self.exchange.get_wallet_balance()
        if self.daily_start_balance is None:
            self.daily_start_balance = current_balance
            return False
        daily_loss_pct = (self.daily_start_balance - current_balance) / self.daily_start_balance * 100
        if daily_loss_pct > self.daily_loss_limit:
            await self.telegram.send_message(f"⚠️ Daily loss limit reached: {daily_loss_pct:.2f}%. Halting.")
            return True
        return False

    async def manage_positions(self):
        """Monitor open positions and update trailing stops"""
        positions = await self.exchange.get_open_positions()
        active_coins = [p['coin'] for p in positions]

        # Cleanup stops for closed positions
        for coin in list(self.active_stops.keys()):
            if coin not in active_coins:
                del self.active_stops[coin]

        for pos in positions:
            coin = pos['coin']
            sz = float(pos['szi'])
            side = "long" if sz > 0 else "short"

            current_price = await self.exchange.get_mid_price(coin)

            if coin in self.active_stops:
                stop_data = self.active_stops[coin]
                if side == "long":
                    new_stop = get_trailing_stop(current_price, stop_data['stop_price'], stop_data['atr'])
                    if new_stop > stop_data['stop_price']:
                        self.active_stops[coin]['stop_price'] = new_stop
                        await self.exchange.update_stop_loss(coin, abs(sz), new_stop)
                        await self.telegram.send_message(f"📈 *Ratchet*: Moving {coin} stop to {new_stop:.2f}")
                        self._save_state()

    async def handle_daily_report(self):
        now = datetime.utcnow()
        if now.hour == 0 and self.hourly_reports:
            report = await self.advisor.generate_daily_report(self.hourly_reports)
            await self.telegram.send_message(f"📋 *Daily Market Report*\n\n{report}")
            self.hourly_reports = []
            self.daily_start_balance = await self.exchange.get_wallet_balance()

    async def run(self):
        asyncio.create_task(self.telegram.run(self))
        print("McMoney Professional Strategy Engine v2.0 started.")

        while True:
            if not self.is_paused:
                if await self.check_daily_loss():
                    self.is_paused = True
                    continue

                # 1. Manage existing positions (Trailing Stop)
                await self.manage_positions()

                # 2. Check for new entries
                decision = await self.engine.decide()

                price = await self.exchange.get_mid_price("BTC")
                market_data = {"price": price, "strategy_decision": decision}
                advisor_report = await self.advisor.analyze(market_data=market_data)
                self.hourly_reports.append(advisor_report)
                await self.logger.log_advisor_report(advisor_report)

                if decision["action"] in ["long", "short"]:
                    positions = await self.exchange.get_open_positions()
                    if any(p['coin'] == "BTC" for p in positions):
                        pass
                    else:
                        order = await self.exchange.place_order(
                            symbol="BTC-USDT",
                            side=decision["action"],
                            size_pct=decision["size_pct"]
                        )
                        self.active_stops["BTC"] = {
                            "stop_price": decision["stop_loss"],
                            "atr": decision.get("atr", 0)
                        }
                        self._save_state()
                        await self.logger.log_trade(decision, order)
                        await self.telegram.send_message(
                            f"🚀 *New Trend Entry*: {decision['action'].upper()} BTC\n"
                            f"Price: {order.get('price')} | Initial Stop: {decision['stop_loss']:.2f}"
                        )

                await self.handle_daily_report()

            for _ in range(360):
                await asyncio.sleep(10)
                if self.is_paused: continue

    def pause(self, *args):
        self.is_paused = True

    def resume(self):
        self.is_paused = False
        self.daily_start_balance = None

if __name__ == "__main__":
    fund = AutonomousHedgeFund()
    loop = asyncio.get_event_loop()
    try:
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, fund.pause)
    except NotImplementedError: pass
    loop.run_until_complete(fund.run())
