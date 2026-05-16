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
from utils.context_server import MarketContextServer

load_dotenv()

class AutonomousHedgeFund:
    def __init__(self):
        self.engine = DeterministicEngine()
        self.exchange = HyperliquidTestnet()
        self.context_server = MarketContextServer()
        self.telegram = TelegramBot()
        self.advisor = LLMAdvisor()
        self.logger = HedgeFundLogger()
        self.is_paused = False
        self.daily_start_balance = None
        self.daily_loss_limit = float(os.getenv("DAILY_LOSS_LIMIT_PCT", 5))
        self.hourly_reports = []
        self.history_logs = []
        self.state_file = os.path.join(os.getenv("LOG_DIR", "/app/data"), "state.json")
        self.active_stops = self._load_state()
        self.dynamic_params = {}

    def _load_state(self):
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, 'r') as f:
                    return json.load(f)
            except: pass
        return {}

    def _save_state(self):
        try:
            os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
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
        positions = await self.exchange.get_open_positions()
        active_coins = [p['coin'] for p in positions]
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
                if stop_data.get('atr', 0) > 0:
                    mult = self.dynamic_params.get('atr_multiplier', stop_data.get('atr_mult', 3.0))
                    new_stop = get_trailing_stop(current_price, stop_data['stop_price'], stop_data['atr'], multiplier=mult, side=side)

                    is_ratchet = (side == "long" and new_stop > stop_data['stop_price']) or \
                                 (side == "short" and new_stop < stop_data['stop_price'])

                    if is_ratchet:
                        self.active_stops[coin]['stop_price'] = new_stop
                        await self.exchange.update_stop_loss(coin, abs(sz), new_stop, side)
                        await self.telegram.send_message(f"📈 *Ratchet*: {coin} {side} stop -> {new_stop:.2f}")
                        self._save_state()

    async def handle_daily_report(self):
        now = datetime.utcnow()
        if now.hour == 0 and self.hourly_reports:
            report = await self.advisor.generate_daily_report(self.hourly_reports)
            await self.telegram.send_message(f"📋 *Daily Report*\n{report}")
            self.hourly_reports = []
            self.daily_start_balance = await self.exchange.get_wallet_balance()

    async def run(self):
        asyncio.create_task(self.telegram.run(self))
        print("McMoney v2.6: Agentic Core Online.")

        while True:
            if not self.is_paused:
                if await self.check_daily_loss():
                    self.is_paused = True
                    continue

                market_context = await self.context_server.get_compressed_context()
                short_memory = await self.context_server.get_short_term_memory(self.history_logs)

                advisor_report = await self.advisor.analyze(
                    market_context=market_context,
                    memory=short_memory
                )
                self.hourly_reports.append(advisor_report)
                await self.logger.log_advisor_report(advisor_report)

                self.dynamic_params = advisor_report.get('tuning', {})

                await self.manage_positions()
                decision = await self.engine.decide(dynamic_params=self.dynamic_params)

                if decision["action"] in ["long", "short"]:
                    positions = await self.exchange.get_open_positions()
                    if not any(p['coin'] == "BTC" for p in positions):
                        order = await self.exchange.place_order(
                            symbol="BTC-USDT",
                            side=decision["action"],
                            size_pct=decision["size_pct"]
                        )
                        self.active_stops["BTC"] = {
                            "stop_price": decision["stop_loss"],
                            "atr": decision.get("atr", 0),
                            "atr_mult": decision.get("atr_mult", 3.0)
                        }
                        self._save_state()
                        await self.exchange.update_stop_loss("BTC", order.get("size", 0), decision["stop_loss"], decision["action"])

                        self.history_logs.append({"action": decision["action"], "coin": "BTC", "ts": datetime.utcnow().isoformat()})
                        await self.logger.log_trade(decision, order)
                        await self.telegram.send_message(
                            f"🚀 *AI-Trade*: {decision['action'].upper()} BTC\n"
                            f"Stop: {decision['stop_loss']:.2f}\n"
                            f"Context: {advisor_report.get('summary')[:100]}..."
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
