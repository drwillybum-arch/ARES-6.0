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
from utils.memory import AgentMemory

load_dotenv()

class AutonomousHedgeFund:
    def __init__(self):
        self.engine = DeterministicEngine()
        self.exchange = HyperliquidTestnet()
        self.context_server = MarketContextServer()
        self.telegram = TelegramBot()
        self.advisor = LLMAdvisor()
        self.logger = HedgeFundLogger()
        self.memory = AgentMemory()

        self.is_paused = False
        self.daily_start_balance = None
        self.daily_loss_limit = float(os.getenv("DAILY_LOSS_LIMIT_PCT", 5))
        self.hourly_reports = []
        self.state_file = os.path.join(os.getenv("LOG_DIR", "/app/data"), "state.json")
        self.active_stops = self._load_state()
        self.dynamic_params = {}

        # Guardrails: Loop prevention and progress tracking
        self.step_counter = 0
        self.consecutive_failures = 0
        self.MAX_CONSECUTIVE_FAILURES = 5
        self.last_action_ts = None

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

    async def plan_step(self):
        """PLANNER: Generates the context and tunes parameters."""
        try:
            market_context = await self.context_server.get_compressed_context()
            memory_context = self.memory.get_context_string()

            advisor_report = await self.advisor.analyze(
                market_context=market_context,
                memory=json.dumps(memory_context)
            )
            self.hourly_reports.append(advisor_report)
            await self.logger.log_advisor_report(advisor_report)

            self.dynamic_params = advisor_report.get('tuning', {})
            return advisor_report
        except Exception as e:
            print(f"Planning failure: {e}")
            return {"summary": "Failed to plan", "tuning": {}}

    async def execute_step(self):
        """EXECUTOR: Carries out trading actions."""
        try:
            # 1. Manage existing positions
            await self.manage_positions()

            # 2. Check for new entries
            decision = await self.engine.decide(dynamic_params=self.dynamic_params)

            outcome = "No Action"
            if decision["action"] in ["long", "short"]:
                positions = await self.exchange.get_open_positions()
                if not any(p['coin'] == "BTC" for p in positions):
                    order = await self.exchange.place_order(
                        symbol="BTC-USDT",
                        side=decision["action"],
                        size_pct=decision["size_pct"]
                    )

                    if order.get("status") == "filled":
                        self.active_stops["BTC"] = {
                            "stop_price": decision["stop_loss"],
                            "atr": decision.get("atr", 0),
                            "atr_mult": decision.get("atr_mult", 3.0)
                        }
                        self._save_state()
                        await self.exchange.update_stop_loss("BTC", order.get("size", 0), decision["stop_loss"], decision["action"])

                        outcome = f"Executed {decision['action']}"
                        self.last_action_ts = datetime.utcnow()
                        await self.logger.log_trade(decision, order)
                        await self.telegram.send_message(f"🚀 *AI-Trade*: {decision['action'].upper()} BTC")
                    else:
                        outcome = f"Execution failed: {order.get('error')}"

            self.consecutive_failures = 0 # Reset on success
            return {"action": decision["action"], "outcome": outcome}

        except Exception as e:
            self.consecutive_failures += 1
            print(f"Execution failure ({self.consecutive_failures}): {e}")
            return {"action": "hold", "outcome": f"Error: {e}"}

    async def reflect_step(self, plan_report, exec_result):
        """REFLECTOR: Quality checks and updates memory."""
        action = exec_result["action"]
        outcome = exec_result["outcome"]

        # Log episode to memory
        self.memory.add_episodic(f"Goal: Trade BTC | Plan: {plan_report.get('summary')[:50]}", outcome)

        # Semantic learning: Record action events
        if action != "hold" and "Executed" in outcome:
            self.memory.add_semantic(f"Last successful action was {action} at {datetime.utcnow().hour}:00")
        elif "Error" in outcome:
            self.memory.add_semantic(f"Detected execution error at {datetime.utcnow().hour}:00: {outcome}")

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
                        self._save_state()

    async def run(self):
        asyncio.create_task(self.telegram.run(self))
        print("McMoney v2.8: Autonomous Agentic Core Online.")

        while True:
            if not self.is_paused:
                # Guardrail: Circuit breaker for consecutive failures
                if self.consecutive_failures >= self.MAX_CONSECUTIVE_FAILURES:
                    await self.telegram.send_message("🚨 *Critical Failure*: Too many consecutive errors. Halting bot.")
                    self.is_paused = True
                    continue

                if await self.check_daily_loss():
                    self.is_paused = True
                    continue

                # 1. PLAN
                plan_report = await self.plan_step()

                # 2. EXECUTE
                exec_result = await self.execute_step()

                # 3. REFLECT
                await self.reflect_step(plan_report, exec_result)

                self.step_counter += 1

                # Progress Tracking: Periodic report
                if self.step_counter % 24 == 0:
                    now = datetime.utcnow()
                    if self.hourly_reports:
                        report = await self.advisor.generate_daily_report(self.hourly_reports)
                        await self.telegram.send_message(f"📋 *Daily Report*\n{report}")
                        self.hourly_reports = []
                        self.daily_start_balance = await self.exchange.get_wallet_balance()

            # Wait 1 hour, but check for pause every 10 seconds
            for _ in range(360):
                await asyncio.sleep(10)
                if self.is_paused: continue

    def pause(self, *args):
        self.is_paused = True

    def resume(self):
        self.is_paused = False
        self.daily_start_balance = None
        self.consecutive_failures = 0

if __name__ == "__main__":
    fund = AutonomousHedgeFund()
    loop = asyncio.get_event_loop()
    try:
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, fund.pause)
    except NotImplementedError: pass
    loop.run_until_complete(fund.run())
