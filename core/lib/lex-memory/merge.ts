import { LexMemory, LexMemoryDelta, Level3Node, Level2Episode, Level1Raw } from "./types";
import { NODE_CAP, EPISODE_CAP_PER_TAB, RAW_CAP_PER_TAB } from "./tokens";

export function mergeMemory(current: LexMemory, delta: LexMemoryDelta): LexMemory {
  const next: LexMemory = {
    ...current,
    updatedAt: Date.now(),
  };

  // Patch L4 theme
  if (delta.themePatches) {
    next.theme = {
      ...current.theme,
      ...delta.themePatches,
      parties: delta.themePatches.parties ?? current.theme.parties,
      statuteRefs: delta.themePatches.statuteRefs
        ? Array.from(new Set([...current.theme.statuteRefs, ...delta.themePatches.statuteRefs]))
        : current.theme.statuteRefs,
      updatedAt: Date.now(),
    };
  }

  // Merge L3 nodes — upsert by id, then cap at NODE_CAP
  if (delta.nodes?.length) {
    const nodeMap = new Map<string, Level3Node>(current.nodes.map(n => [n.id, n]));
    for (const n of delta.nodes) {
      const existing = nodeMap.get(n.id);
      if (existing) {
        // Merge confirmedBy arrays and take higher confidence
        const merged: Level3Node = { ...existing, ...n } as Level3Node;
        if ("confirmedBy" in existing && "confirmedBy" in n) {
          (merged as Extract<Level3Node, { confirmedBy: string[] }>).confirmedBy =
            Array.from(new Set([...(existing as { confirmedBy: string[] }).confirmedBy, ...(n as { confirmedBy: string[] }).confirmedBy])) as never;
        }
        nodeMap.set(n.id, merged);
      } else {
        nodeMap.set(n.id, n);
      }
    }
    // Cap: drop lowest-score nodes (score=0 for unranked)
    const all = Array.from(nodeMap.values());
    next.nodes = all
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, NODE_CAP);
  }

  // Merge L2 episodes — prepend, cap per tab
  if (delta.episode) {
    const ep = delta.episode;
    const tabEps = current.episodes.filter(e => e.tab === ep.tab);
    const otherEps = current.episodes.filter(e => e.tab !== ep.tab);
    const newTabEps = [ep, ...tabEps].slice(0, EPISODE_CAP_PER_TAB);
    next.episodes = [...newTabEps, ...otherEps];
  }

  // Merge L1 raw — prepend, cap per tab
  if (delta.raw) {
    const r = delta.raw;
    const tabRaw = current.raw.filter(x => x.tab === r.tab);
    const otherRaw = current.raw.filter(x => x.tab !== r.tab);
    const newTabRaw = [r, ...tabRaw].slice(0, RAW_CAP_PER_TAB);
    next.raw = [...newTabRaw, ...otherRaw];
  }

  return next;
}
