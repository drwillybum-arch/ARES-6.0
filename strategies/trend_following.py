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

async def trend_signal(dynamic_params=None):
    """
    Professional Trend Following Strategy with Dynamic Agentic Tuning
    Fixed: Data mapping for Hyperliquid candle dictionary keys.
    """
    try:
        # Default Parameters
        atr_mult = 3.0
        risk_pct = float(os.getenv("RISK_PER_TRADE_PCT", 0.5))
        lookback = 20

        # Apply Dynamic Agentic Overrides
        if dynamic_params:
            atr_mult = dynamic_params.get('atr_multiplier', atr_mult)
            risk_pct = dynamic_params.get('risk_pct', risk_pct)
            lookback = dynamic_params.get('breakout_window', lookback)

        client = HyperliquidTestnet()
        candles = await client.get_candles("BTC", "4h")

        if not candles or len(candles) < 200:
            candles = await client.get_candles("BTC", "1h")
            if not candles or len(candles) < 200:
                return {"action": "hold"}

        # Hyperliquid SDK returns list of dicts: {'t': timestamp, 'o': open, 'h': high, 'l': low, 'c': close, 'v': volume}
        df = pd.DataFrame(candles)
        df = df.rename(columns={'t': 'timestamp', 'o': 'open', 'h': 'high', 'l': 'low', 'c': 'close', 'v': 'volume'})

        df['close'] = df['close'].astype(float)
        df['high'] = df['high'].astype(float)
        df['low'] = df['low'].astype(float)

        df['sma200'] = df['close'].rolling(window=200).mean()
        df['sma50'] = df['close'].rolling(window=50).mean()

        last = df.iloc[-1]
        is_bull = last['close'] > last['sma200'] and last['sma50'] > last['sma200']

        if not is_bull:
            return {"action": "hold", "reason": "non-bull regime"}

        df['hi_lookback'] = df['high'].rolling(window=int(lookback)).max()
        atr = compute_atr(df, 14)
        last_atr = atr.iloc[-1]

        # Entry logic
        if last['close'] >= df['hi_lookback'].iloc[-2]:
            initial_stop = last['close'] - (atr_mult * last_atr)

            return {
                "action": "long",
                "size_pct": risk_pct,
                "entry_price": last['close'],
                "stop_loss": initial_stop,
                "atr": last_atr,
                "atr_mult": atr_mult
            }

    except Exception as e:
        print(f"Error in trend_signal: {e}")

    return {"action": "hold"}

def get_trailing_stop(current_price, current_stop, atr, multiplier=3.0):
    new_stop = current_price - (multiplier * atr)
    return max(current_stop, new_stop)
