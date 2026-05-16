import os
import asyncio
from hyperliquid.info import Info
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants

class HyperliquidTestnet:
    def __init__(self):
        self.wallet = os.getenv("HYPERLIQUID_TESTNET_WALLET")
        self.private_key = os.getenv("HYPERLIQUID_TESTNET_PRIVATE_KEY")
        self.dry_run = os.getenv("DRY_RUN", "true").lower() == "true"

        wallet = self.wallet or "0x0000000000000000000000000000000000000000"
        key = self.private_key or "0x0000000000000000000000000000000000000000000000000000000000000000"

        self.exchange = Exchange(wallet, key, base_url=constants.TESTNET_API_URL)
        self.info = Info(base_url=constants.TESTNET_API_URL)

    async def get_wallet_balance(self):
        if not self.wallet: return 10000.0
        loop = asyncio.get_running_loop()
        try:
            user_state = await loop.run_in_executor(None, self.info.user_state, self.wallet)
            return float(user_state['marginSummary']['accountValue'])
        except Exception as e:
            print(f"Error fetching balance: {e}")
            return 10000.0

    async def get_open_positions(self):
        if not self.wallet: return []
        loop = asyncio.get_running_loop()
        try:
            user_state = await loop.run_in_executor(None, self.info.user_state, self.wallet)
            positions = []
            for pos in user_state['assetPositions']:
                p = pos['position']
                if float(p['szi']) != 0:
                    positions.append(p)
            return positions
        except Exception as e:
            print(f"Error fetching positions: {e}")
            return []

    async def get_candles(self, coin, interval, start_time=None, end_time=None):
        loop = asyncio.get_running_loop()
        try:
            return await loop.run_in_executor(None, self.info.candles_snapshot, coin, interval, start_time, end_time)
        except Exception as e:
            print(f"Error fetching candles: {e}")
            return []

    async def get_mid_price(self, coin):
        loop = asyncio.get_running_loop()
        try:
            all_mids = await loop.run_in_executor(None, self.info.all_mids)
            return float(all_mids[coin])
        except Exception as e:
            print(f"Error fetching mid price: {e}")
            return None

    async def get_funding_rate(self, coin):
        loop = asyncio.get_running_loop()
        try:
            funding_history = await loop.run_in_executor(None, self.info.funding_history, coin)
            if funding_history:
                return float(funding_history[0]['fundingRate'])
            return 0.0
        except Exception as e:
            print(f"Error fetching funding rate: {e}")
            return 0.0

    async def get_l2_snapshot(self, coin):
        """Fetch L2 Order Book Snapshot"""
        loop = asyncio.get_running_loop()
        try:
            return await loop.run_in_executor(None, self.info.l2_snapshot, coin)
        except Exception as e:
            print(f"Error fetching L2 snapshot: {e}")
            return None

    async def place_order(self, symbol, side, size_pct):
        coin = symbol.split("-")[0]
        is_buy = (side == "long")
        try:
            price = await self.get_mid_price(coin)
            balance = await self.get_wallet_balance()
            usd_size = balance * (size_pct / 100.0)
            sz = usd_size / price

            print(f"[ORDER] {side.upper()} {coin} | Size: {sz:.4f} | Price: {price}")

            if self.dry_run:
                return {"order_id": "dry_run", "status": "filled", "price": price, "size": sz}

            loop = asyncio.get_running_loop()
            order_result = await loop.run_in_executor(None, self.exchange.market_open, coin, is_buy, sz, price, 0.01)

            if order_result.get('status') == 'err':
                raise Exception(order_result.get('response'))

            return {"order_id": "executed", "status": "filled", "price": price, "size": sz, "response": order_result}
        except Exception as e:
            print(f"Error placing order: {e}")
            return {"order_id": "error", "status": "failed", "error": str(e)}

    async def update_stop_loss(self, coin, sz, stop_price, side):
        print(f"[STOP] Placing {coin} stop-loss at {stop_price:.2f} (Reduce-Only)")
        if self.dry_run:
            return True
        loop = asyncio.get_running_loop()
        try:
            is_buy = (side == "short")
            order_result = await loop.run_in_executor(
                None,
                self.exchange.order,
                coin,
                is_buy,
                sz,
                stop_price,
                {"trigger": {"triggerPx": stop_price, "isMarket": True, "tpsl": "sl"}},
                True
            )
            if order_result.get('status') == 'err':
                print(f"Stop loss error: {order_result.get('response')}")
                return False
            return True
        except Exception as e:
            print(f"Error updating stop loss: {e}")
            return False
