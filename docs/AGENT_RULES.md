# McMoney Agent Rules: Goal-Driven Autonomy

## 1. The PER Architectural Pattern
The bot operates on a **Planner-Executor-Reflector (PER)** loop (Nagasubramanian, 2026).

### A. Planner (Reasoning)
- **Goal**: Optimize trading parameters for the current regime.
- **Inputs**: Compressed JSON Context Feed (Technicals, Macro, OBI) + Episodic Memory.
- **Outputs**: Dynamically tuned `atr_multiplier`, `risk_pct`, and `breakout_window`.

### B. Executor (Action)
- **Goal**: Map plans to deterministic tool calls.
- **Rules**: Must obey hard-coded guardrails (`MAX_RISK_PCT`) regardless of Planner advice.
- **Actions**: `place_order`, `update_stop_loss`.

### C. Reflector (Learning)
- **Goal**: Observe outcomes and update internal models.
- **Action**: Commit the trade result (success/failure) to Episodic Memory. Update Semantic Memory with verified market facts.

## 2. Memory Hygiene
- **Episodic**: Limited to the last 100 cycles to prevent context window bloating.
- **Semantic**: Stores verified facts that are reused across cycles.
- **Working**: Wiped after every 1-hour cycle to ensure each decision begins with fresh reasoning grounded in long-term memory.

## 3. Infrastructure-Level Guardrails
- **Outside the Model**: Safety logic lives in the Python code, not in the LLM prompts.
- **Circuit Breakers**:
  - **Consecutive Failure**: Halt after 5 network/execution errors.
  - **Authorization**: Only the registered `TELEGRAM_USERID` can issue commands.
  - **Reduce-Only**: All stop-losses are strictly marked as reduce-only to prevent unintended position opening.
