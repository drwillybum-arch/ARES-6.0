import { Level3Node, TabId } from "./types";

const COURT_TIER_WEIGHT: Record<string, number> = {
  scotus: 1.0,
  circuit: 0.85,
  "state-high": 0.75,
  district: 0.6,
  "state-lower": 0.5,
  unknown: 0.4,
};

// Importance score formula:
// recency × confirmation × relevance × authority × verified × tabAffin × supersede
export function scoreNode(node: Level3Node, opts: { currentTab: TabId; now: number }): number {
  const { currentTab, now } = opts;

  // recency: half-life of 7 days
  const ageMs = now - ("lastRefAt" in node ? node.lastRefAt : ("raisedAt" in node ? node.raisedAt : now));
  const ageDays = ageMs / 86_400_000;
  const recency = Math.pow(0.5, ageDays / 7);

  // confirmation: how many tabs have referenced this
  const confirmedByCount = "confirmedBy" in node ? node.confirmedBy.length : 1;
  const confirmation = Math.min(1, 0.5 + confirmedByCount * 0.15);

  // authority weight (by court tier for case authorities)
  const authority = node.kind === "authority"
    ? (COURT_TIER_WEIGHT[node.courtTier] ?? 0.4)
    : 0.7;

  // verified boost
  const verified = node.kind === "authority" && node.verified ? 1.2 : 1.0;

  // tab affinity: higher if the current tab typically uses this kind of node
  const tabAffin = getTabAffinity(node, currentTab);

  // confidence
  const confidence = "confidence" in node ? node.confidence / 3 : 0.6;

  return recency * confirmation * authority * verified * tabAffin * confidence;
}

function getTabAffinity(node: Level3Node, tab: TabId): number {
  if (node.kind === "authority") {
    if (tab === "strategy" || tab === "draft" || tab === "research") return 1.0;
    if (tab === "judge") return 0.7;
    return 0.5;
  }
  if (node.kind === "strategy") {
    if (tab === "strategy" || tab === "draft") return 1.0;
    if (tab === "research") return 0.7;
    return 0.4;
  }
  if (node.kind === "open") {
    return 0.9; // open questions are broadly relevant
  }
  return 0.6;
}

export function rankNodes(nodes: Level3Node[], currentTab: TabId): Level3Node[] {
  const now = Date.now();
  return nodes
    .map(n => ({ ...n, score: scoreNode(n, { currentTab, now }) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
