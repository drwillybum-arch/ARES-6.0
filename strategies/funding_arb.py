import aiohttp
import os
from utils.hyperliquid_client import HyperliquidTestnet

async def get_hyperliquid_funding(coin="BTC"):
    client = HyperliquidTestnet()
    return await client.get_funding_rate(coin)

async def funding_arb_signal():
    rate = await get_hyperliquid_funding()
    # Threshold 0.01% (0.0001)
    if rate > 0.0001:
        return {
            "action": "short",
            "size_pct": float(os.getenv("RISK_PER_TRADE_PCT", 0.5)),
            "stop_loss": 1.05,   # 5% above entry for short
            "take_profit": 0.99, # 1% below entry
            "atr": 0.0 # Placeholder for funding arb
        }
    elif rate < -0.0001:
        return {
            "action": "long",
            "size_pct": float(os.getenv("RISK_PER_TRADE_PCT", 0.5)),
            "stop_loss": 0.95,
            "take_profit": 1.01,
            "atr": 0.0
        }
    return {"action": "hold"}
