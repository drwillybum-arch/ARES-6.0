# McMoney v2.0: Asymmetric Trend-Following System

## 1. Executive Summary & Expected Performance
The McMoney v2.0 system is a professional-grade quantitative trading system designed for Hyperliquid perpetuals. It focuses on capturing outsized gains during confirmed crypto bull markets while maintaining a strictly defined downside through an ATR-based trailing stop (Chandelier Exit).

- **Expected Sharpe**: 0.8 - 1.2 (in bull regimes)
- **Max Drawdown Target**: < 15%
- **Profit Factor**: > 1.5

## 2. Bull Market Filter Specification
The system uses a multi-stage regime detection filter to ensure trades are only executed during high-conviction uptrends.
- **Primary Filter**: `Price > 200 SMA (Daily)`
- **Momentum Filter**: `50 SMA > 200 SMA`
- **Vol Filter**: `Funding Rate < 0.05%` (to avoid peak euphoria/over-leverage)

## 3. Entry Rules
- **Asset Universe**: BTC, ETH.
- **Signal**: 20-period Donchian Channel High Breakout on the 4H timeframe.
- **Confirmation**: Price closing above the previous 20-period high.

## 4. Trailing Stop & Risk Engine
The core of the system is the "Rachet" Trailing Stop, based on the Chandelier Exit.
- **Initial Stop**: `Entry Price - (3.0 * 14-period ATR)`
- **Trailing Logic**: As price moves higher, the stop is updated to `MAX(Current Stop, Current Price - 3.0 * ATR)`.
- **Exit**: Position is closed only when the trailing stop is hit or the daily loss limit (4%) is triggered.

## 5. Complete System Parameters
| Parameter | Value |
|-----------|-------|
| Risk Per Trade | 0.5% of Equity |
| Max Concurrent Positions | 3 |
| ATR Period | 14 |
| ATR Multiplier | 3.0 |
| Regime Window | 200 |
| Breakout Window | 20 |

## 6. Deployment & Monitoring
Deployed via Railway using Docker. Monitoring is conducted 24/7 through a Telegram Bot providing:
- Real-time "Ratchet" alerts.
- Daily aggregate market analysis via LLM advisor.
- `/status` command for current equity and active stops.

## 7. Psychological Edge
By removing fixed take-profits, the system removes the human tendency to "sell winners too early." It allows the mathematical probability of a "parabolic run" to fully play out while ensuring that any reversal is caught within a 3xATR volatility window.
