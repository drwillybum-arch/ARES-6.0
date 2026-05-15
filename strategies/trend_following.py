import pandas as pd
import numpy as np
import os
from utils.hyperliquid_client import HyperliquidTestnet

def compute_rsi(prices, period=14):
    if len(prices) < period:
        return pd.Series([50] * len(prices))
    delta = prices.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=period).mean()
    avg_loss = loss.rolling(window=period).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

async def trend_signal():
    """Fetch live candles and generate a trend signal"""
    try:
        client = HyperliquidTestnet()
        # Fetch 1H candles for BTC
        candles = await client.get_candles("BTC", "1h")

        if not candles or len(candles) < 50:
            return {"action": "hold"}

        # Hyperliquid candles format: [t, o, h, l, c, v]
        df = pd.DataFrame(candles, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['close'] = df['close'].astype(float)

        df['ema20'] = df['close'].ewm(span=20).mean()
        df['ema50'] = df['close'].ewm(span=50).mean()
        df['rsi'] = compute_rsi(df['close'])

        last = df.iloc[-1]
        risk_pct = float(os.getenv("RISK_PER_TRADE_PCT", 0.5))

        if last['ema20'] > last['ema50'] and last['rsi'] < 30:
            return {
                "action": "long",
                "size_pct": risk_pct,
                "stop_loss": 0.95,
                "take_profit": 1.02
            }
        elif last['ema20'] < last['ema50'] and last['rsi'] > 70:
            return {
                "action": "short",
                "size_pct": risk_pct,
                "stop_loss": 1.05,
                "take_profit": 0.98
            }
    except Exception as e:
        print(f"Error in trend_signal: {e}")

    return {"action": "hold"}
