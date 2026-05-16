import asyncio
import aiohttp
import pandas as pd
import json
from datetime import datetime
from utils.hyperliquid_client import HyperliquidTestnet

class MarketContextServer:
    """
    Centralized 'MCP-style' context aggregator.
    Compresses technicals, news, and cross-asset data into an LLM-optimized feed.
    """
    def __init__(self):
        self.exchange = HyperliquidTestnet()
        self.data_cache = {}

    async def get_compressed_context(self, coins=["BTC", "ETH"]):
        """
        Gathers data from multiple sources and returns a dense, token-efficient string.
        """
        # 1. Gather Crypto Technicals
        crypto_data = {}
        for coin in coins:
            candles = await self.exchange.get_candles(coin, "1h")
            if candles:
                df = pd.DataFrame(candles)
                df = df.rename(columns={'t': 't', 'o': 'o', 'h': 'h', 'l': 'l', 'c': 'c', 'v': 'v'})
                last = df.iloc[-1]
                mid = await self.exchange.get_mid_price(coin)
                funding = await self.exchange.get_funding_rate(coin)

                crypto_data[coin] = {
                    "px": mid,
                    "fnd": f"{funding*100:.4f}%",
                    "vol24h": last['v'],
                    "chg1h": f"{(float(last['c'])/float(df.iloc[-2]['c'])-1)*100:.2f}%"
                }

        # 2. Gather Real Macro Context (Mocked integration point for stocks/macros)
        # In a real build, we'd use AlphaVantage or Yahoo Finance here.
        macro_data = await self._fetch_macro_data()

        # 3. Compress into Token-Dense Format
        compressed = {
            "ts": datetime.utcnow().isoformat()[:16],
            "mkt": crypto_data,
            "macro": macro_data,
            "alerts": ["BTC breakout imminent", "DXY weakening"]
        }

        # Separators=(',', ':') removes whitespace for token efficiency
        return json.dumps(compressed, separators=(',', ':'))

    async def _fetch_macro_data(self):
        """
        Fetches stock and macro data.
        """
        # Logic to fetch from external APIs would go here.
        # Placeholder for real macro state:
        return {
            "SPY": "520.50 (+0.2%)",
            "DXY": "104.10 (-0.1%)",
            "US10Y": "4.35%",
            "BTC_Dom": "54.2%"
        }

    async def get_short_term_memory(self, history_logs):
        if not history_logs:
            return "None"
        recent = history_logs[-5:]
        return "|".join([f"{e.get('action')}:{e.get('coin')}" for e in recent])
