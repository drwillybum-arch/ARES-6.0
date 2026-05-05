import { LexMemory, Level3Node, Level2Episode, Level4Theme } from "./types";

// ── Caveman serialization ─────────────────────────────────────────────────
// Line-oriented, pipe-delimited, prefix-tagged.
// Removes articles/hedges/connectives, preserves citations/numbers/proper nouns.
// ~65% token reduction vs prose equivalents.

function serializeTheme(t: Level4Theme): string {
  const parts: string[] = [];
  if (t.matterType) parts.push(t.matterType.replace(/\s+/g, "_").toLowerCase());
  if (t.jurisdiction) parts.push(t.jurisdiction.replace(/\s+/g, "_").toLowerCase());
  if (t.court) parts.push(t.court.replace(/\s+/g, "_").toLowerCase());
  if (t.parties.length) {
    for (const p of t.parties.slice(0, 4)) {
      parts.push(`${p.role.charAt(0)}:${p.name.replace(/\s+/g, "_").toLowerCase()}`);
    }
  }
  if (t.primaryTheory) parts.push(`theory:${t.primaryTheory.replace(/\s+/g, "_").toLowerCase()}`);
  if (t.posture) parts.push(`posture:${t.posture}`);
  for (const s of t.statuteRefs.slice(0, 4)) parts.push(`stat:${s}`);
  return `MATTER|${parts.join("|")}`;
}

function serializeNode(n: Level3Node): string {
  if (n.kind === "authority") {
    const v = n.verified ? "v:1" : "v:0";
    return `AUTH|${n.shortCite.replace(/[\s,]+/g, "_")}|${n.citation.replace(/[\s,]+/g, "_").substring(0, 40)}|${n.authorityKind}|${n.courtTier}|${v}|cf:${n.confidence}`;
  }
  if (n.kind === "strategy") {
    return `STRAT|${n.id}|${n.detail?.replace(/\s+/g, "_").substring(0, 60) ?? ""}|cf:${n.confidence}`;
  }
  // open question
  return `OPEN|${n.question.replace(/\s+/g, "_").substring(0, 80)}${n.blocking ? "|BLOCKING" : ""}`;
}

function serializeEpisode(ep: Level2Episode): string {
  const cavemanSummary = ep.summary
    .replace(/\b(the|a|an|is|are|was|were|have|has|been|this|that|these|those|which|with|from|and|but|or|for|not|by|be|at|on|in)\b/gi, "")
    .replace(/\s{2,}/g, "+")
    .trim();
  return `EP|${ep.tab}|${ep.date}|${cavemanSummary}`;
}

export function buildContextBlock(
  mem: LexMemory,
  opts: { budget: number; currentTab?: string }
): { text: string; tokensUsed: number } {
  const lines: string[] = [];
  let budget = opts.budget;

  // Always: L4 theme
  const themeLine = serializeTheme(mem.theme);
  lines.push(themeLine);
  budget -= Math.ceil(themeLine.length / 4);

  // Always: blocking open questions (up to budget)
  const blocking = mem.nodes
    .filter((n): n is Extract<Level3Node, { kind: "open" }> => n.kind === "open" && n.blocking && !n.resolvedAt)
    .slice(0, 3);
  for (const n of blocking) {
    const line = serializeNode(n);
    const cost = Math.ceil(line.length / 4);
    if (budget - cost < 0) break;
    lines.push(line);
    budget -= cost;
  }

  // Greedy fill: L3 nodes by score (pre-sorted by rank.ts before call)
  const ranked = [...mem.nodes]
    .filter(n => n.kind !== "open" || !(n as Extract<Level3Node, { kind: "open" }> ).blocking)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  for (const n of ranked) {
    const line = serializeNode(n);
    const cost = Math.ceil(line.length / 4);
    if (budget - cost < 0) break;
    lines.push(line);
    budget -= cost;
  }

  // L2 episodes: 2 most recent (prefer current tab first)
  const sortedEps = [...mem.episodes].sort((a, b) => b.createdAt - a.createdAt);
  const prioritized = [
    ...sortedEps.filter(e => e.tab === opts.currentTab),
    ...sortedEps.filter(e => e.tab !== opts.currentTab),
  ].slice(0, 2);
  for (const ep of prioritized) {
    const line = serializeEpisode(ep);
    const cost = Math.ceil(line.length / 4);
    if (budget - cost < 0) break;
    lines.push(line);
    budget -= cost;
  }

  if (lines.length === 0) return { text: "", tokensUsed: 0 };

  const text = `<LEX_MEMORY v=1>\n${lines.join("\n")}\n</LEX_MEMORY>`;
  return { text, tokensUsed: Math.ceil(text.length / 4) };
}

// ── Caveman prose compression (for L2 episode summaries) ─────────────────
const STOP_WORDS = new Set([
  "the","a","an","is","are","was","were","have","has","been","this","that",
  "these","those","which","with","from","and","but","or","for","not","by",
  "be","at","on","in","to","of","it","its","as","so","if","when","then",
  "also","however","therefore","thus","although","because","while","since",
  "very","quite","rather","somewhat","generally","typically","often","usually",
  "may","might","could","would","should","shall","will","can","do","did",
]);

export function cavemanCompress(text: string): string {
  return text
    .split(/\s+/)
    .filter(w => !STOP_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, "")))
    .join("+")
    .replace(/\++/g, "+")
    .trim();
}
