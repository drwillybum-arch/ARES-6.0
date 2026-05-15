import pandas as pd
import numpy as np
import os
from utils.hyperliquid_client import HyperliquidTestnet

def compute_atr(df, period=14):
    high_low = df['high'] - df['low']
    high_cp = (df['high'] - df['close'].shift()).abs()
    low_cp = (df['low'] - df['close'].shift()).abs()
    tr = pd.concat([high_low, high_cp, low_cp], axis=1).max(axis=1)
    atr = tr.rolling(window=period).mean()
    return atr

async def trend_signal():
    """
    Professional Trend Following Strategy
    - Regime: Price > 200 SMA (approximated from shorter candles if needed)
    - Entry: 20-period High breakout
    - Stop: ATR-based trailing (Chandelier Exit)
    """
    try:
        client = HyperliquidTestnet()
        # Fetch 4H candles for a broader view
        candles = await client.get_candles("BTC", "4h")

        if not candles or len(candles) < 200:
            # Fallback to 1h if 4h not enough data
            candles = await client.get_candles("BTC", "1h")
            if not candles or len(candles) < 200:
                return {"action": "hold"}

        df = pd.DataFrame(candles, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['close'] = df['close'].astype(float)
        df['high'] = df['high'].astype(float)
        df['low'] = df['low'].astype(float)

        # 1. Regime Detection (Bull Market Filter)
        df['sma200'] = df['close'].rolling(window=200).mean()
        df['sma50'] = df['close'].rolling(window=50).mean()

        last = df.iloc[-1]
        is_bull = last['close'] > last['sma200'] and last['sma50'] > last['sma200']

        if not is_bull:
            return {"action": "hold", "reason": "non-bull regime"}

        # 2. Entry Signal (Breakout)
        df['hi20'] = df['high'].rolling(window=20).max()
        atr = compute_atr(df, 14)
        last_atr = atr.iloc[-1]

        # Current price above previous 20-period high
        if last['close'] >= df['hi20'].iloc[-2]:
            risk_pct = float(os.getenv("RISK_PER_TRADE_PCT", 0.5))
            # Chandelier Exit Initial Stop: Close - 3 * ATR
            initial_stop = last['close'] - (3.0 * last_atr)

            return {
                "action": "long",
                "size_pct": risk_pct,
                "entry_price": last['close'],
                "stop_loss": initial_stop,
                "atr": last_atr
            }

    except Exception as e:
        print(f"Error in trend_signal: {e}")

    return {"action": "hold"}

def get_trailing_stop(current_price, current_stop, atr, multiplier=3.0):
    """Calculates the new trailing stop price (ratchet only)"""
    new_stop = current_price - (multiplier * atr)
    return max(current_stop, new_stop)
