import { LexMemory, TabId } from "./types";
import { rankNodes } from "./rank";
import { buildContextBlock } from "./compress";
import { BUDGET_DEFAULT } from "./tokens";

export interface BuildContextOpts {
  budget?: number;
  currentTab?: TabId;
}

export function buildContext(mem: LexMemory, opts: BuildContextOpts = {}): { text: string; tokensUsed: number } {
  const budget = opts.budget ?? BUDGET_DEFAULT;

  // Rank all nodes before passing to serializer
  const rankedMem: LexMemory = {
    ...mem,
    nodes: rankNodes(mem.nodes, opts.currentTab ?? "research"),
  };

  return buildContextBlock(rankedMem, { budget, currentTab: opts.currentTab });
}
