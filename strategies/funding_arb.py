import aiohttp
import os
from utils.hyperliquid_client import HyperliquidTestnet

async def get_hyperliquid_funding(coin="BTC"):
    client = HyperliquidTestnet()
    return await client.get_funding_rate(coin)

async def funding_arb_signal():
    """
    Returns funding arbitrage signal with absolute stop loss and take profit prices.
    """
    client = HyperliquidTestnet()
    rate = await client.get_funding_rate("BTC")
    price = await client.get_mid_price("BTC")

    if price is None:
        return {"action": "hold"}

    risk_pct = float(os.getenv("RISK_PER_TRADE_PCT", 0.5))

    # Threshold 0.01% (0.0001)
    if rate > 0.0001:
        # Short position: stop loss above, take profit below
        return {
            "action": "short",
            "size_pct": risk_pct,
            "stop_loss": price * 1.05,   # 5% above entry
            "take_profit": price * 0.99,  # 1% below entry
            "atr": 0.0
        }
    elif rate < -0.0001:
        # Long position: stop loss below, take profit above
        return {
            "action": "long",
            "size_pct": risk_pct,
            "stop_loss": price * 0.95,
            "take_profit": price * 1.01,
            "atr": 0.0
        }
    return {"action": "hold"}
