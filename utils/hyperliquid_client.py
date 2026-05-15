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
        """Fetch actual wallet balance from Hyperliquid testnet"""
        if not self.wallet:
            return 10000.0

        loop = asyncio.get_running_loop()
        try:
            user_state = await loop.run_in_executor(None, self.info.user_state, self.wallet)
            return float(user_state['marginSummary']['accountValue'])
        except Exception as e:
            print(f"Error fetching balance: {e}")
            return 10000.0

    async def get_candles(self, coin, interval, start_time=None, end_time=None):
        """Fetch OHLCV data from Hyperliquid"""
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

    async def place_order(self, symbol, side, size_pct, stop_loss=None, take_profit=None):
        """Place an order on Hyperliquid testnet"""
        coin = symbol.split("-")[0]
        is_buy = side == "long"

        try:
            price = await self.get_mid_price(coin)
            if price is None:
                raise ValueError(f"Could not get price for {coin}")

            balance = await self.get_wallet_balance()
            usd_size = balance * (size_pct / 100.0)
            sz = usd_size / price

            print(f"Executing {side} on {coin}: {sz:.4f} tokens at ~{price}")

            if self.dry_run:
                print("Dry run enabled, skipping actual order.")
                return {"order_id": "dry_run", "status": "filled", "price": price, "size": sz}

            loop = asyncio.get_running_loop()
            order_result = await loop.run_in_executor(None, self.exchange.market_open, coin, is_buy, sz, price, 0.01)

            if order_result.get('status') == 'err':
                return {"order_id": "error", "status": "failed", "error": order_result.get('response')}

            return {"order_id": "executed", "status": "filled", "price": price, "size": sz, "response": order_result}

        except Exception as e:
            print(f"Error placing order: {e}")
            return {"order_id": "error", "status": "failed", "error": str(e)}
