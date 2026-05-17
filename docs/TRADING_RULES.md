# McMoney Trading Rules: Quantitative Strategy Deep-Dive

## 1. Macro Regime Filter (The 200 SMA Pillar)
We only trade when the long-term trend is confirmed to be BULLISH.
- **Rules**:
  - `Current Price > 200 SMA (Daily)`
  - `50 SMA > 200 SMA (Daily)`
- **Logic**: Prevents over-trading during bear markets or sideways chop. We only want to be active when the "tide is rising."

## 2. Momentum Entry (Donchian Breakout)
- **Timeframe**: 4H (to balance noise reduction with responsiveness).
- **Signal**: Price must touch or exceed the 20-period High of the Donchian Channel.
- **Confirmation**: Entry is only valid if the 4H candle closes at or above the breakout level.

## 3. Microstructure Filter (Order Book Imbalance)
Before any breakout is traded, the bot decodes hidden liquidity via L2 snapshots.
- **Formula**: `OBI = (Bid Volume - Ask Volume) / (Bid Volume + Ask Volume)`
- **Threshold**: `OBI > 0.3` (for Longs).
- **Logic**: If a breakout occurs but OBI is negative, it is likely a "Bull Trap" or a "Liquidity Grab" by institutional players.

## 4. Asymmetric Exit (The Ratchet Stop)
- **Type**: Chandelier Exit (ATR-based trailing stop).
- **Formula**: `Stop = Current Price - (3.0 * ATR)`.
- **Ratchet Rule**: The stop can only move UP (for Longs). If the new calculated stop is lower than the current stop, the current stop remains.
- **Zero Take-Profit Policy**: We never exit winners early. We allow the market to trend parabolic and only exit when the 3xATR trailing stop is hit.

## 5. Risk Management
- **Risk Per Trade**: Fixed at 0.5% (dynamically scalable up to 2.0% via Agentic Tuning).
- **Max Portfolio Heat**: 3 concurrent positions maximum.
- **Daily Drawdown Cap**: Bot halts if total account value drops > 5% in a rolling 24h window.
