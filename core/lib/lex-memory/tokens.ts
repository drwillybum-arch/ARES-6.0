// Rough token estimate: 1 token ≈ 4 chars (works across all 9 waterfall providers)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export const BUDGET_DEFAULT = 250;
export const BUDGET_THEME = 50;      // L4 — always consumed
export const BUDGET_BLOCKING = 60;   // blocking OPEN questions — forced
export const BUDGET_EPISODE = 50;    // per L2 episode (inject 2 most recent)
export const NODE_CAP = 80;
export const EPISODE_CAP_PER_TAB = 3;
export const RAW_CAP_PER_TAB = 5;
