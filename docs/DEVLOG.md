# McMoney Devlog: Evolution of an Agent

### Phase 1: The Foundation
- Initiated project "McMoney" from a clean slate.
- Integrated `hyperliquid-python-sdk` for testnet execution.
- Implemented basic hourly trading loop and CSV logging.

### Phase 2: Quantitative Maturity (The "Jules" Persona)
- Transitioned to asymmetric trend-following.
- Added 200 SMA Daily regime filters.
- Implemented Chandelier Exit (ATR-based) "Ratchet" trailing stops.
- Switched to 4H Donchian Channel breakouts for entry.

### Phase 3: Microstructure Awareness
- Added Order Book Imbalance (OBI) calculation using L2 snapshots.
- Integrated OBI as a confirmation filter for all trend entries.

### Phase 4: Agentic Autonomy (Nagasubramanian 2026)
- Refactored the core into a Planner-Executor-Reflector (PER) loop.
- Implemented a multi-tier Memory Architecture (Episodic + Semantic).
- Optimized context windows using token-dense JSON feeds.
- Added hard-coded infrastructure guardrails (MAX_RISK_PCT, Failure Circuit Breakers).

### Phase 5: Production & Documentation
- Finalized comprehensive documentation suite.
- Optimized for one-click Railway deployment.
- Refined Telegram bot control interface.
