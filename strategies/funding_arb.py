import aiohttp
import os

async def get_hyperliquid_funding(coin="BTC"):
    async with aiohttp.ClientSession() as session:
        async with session.post("https://api.hyperliquid.xyz/info", json={"type": "fundingHistory", "coin": coin}) as resp:
            data = await resp.json()
            if data:
                return float(data[0]["fundingRate"])
    return 0.0

async def funding_arb_signal():
    rate = await get_hyperliquid_funding()
    # Threshold 0.01% (0.0001)
    if rate > 0.0001:
        return {
            "action": "short",
            "size_pct": float(os.getenv("RISK_PER_TRADE_PCT", 0.5)),
            "stop_loss": 1.05,   # 5% above entry for short
            "take_profit": 0.99  # 1% below entry
        }
    elif rate < -0.0001:
        return {
            "action": "long",
            "size_pct": float(os.getenv("RISK_PER_TRADE_PCT", 0.5)),
            "stop_loss": 0.95,
            "take_profit": 1.01
        }
    return {"action": "hold"}
