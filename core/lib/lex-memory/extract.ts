import { LexMemoryDelta, Level3Authority, Level3Strategy, Level3OpenQuestion, Level2Episode, Level1Raw, TabId, CourtTier, AuthorityKind, Confidence } from "./types";
import { cavemanCompress } from "./compress";
import { isAresShadow, type AresShadow, type AresShadowCite } from "../../lib/ares/shadow-schema";

// ── Regex patterns ────────────────────────────────────────────────────────

// Full Bluebook case citation: Name v. Name, 123 F.3d 456 (Court Year)
const CASE_CITATION_RE = /([A-Z][A-Za-z\s\.\-']+(?:v\.|vs\.)\s*[A-Z][A-Za-z\s\.\-']+),\s*(\d+\s+[A-Za-z\.\s]+\d+(?:,\s+\d+)?)\s*\(([^)]+\s+\d{4})\)/g;

// Statute citation: 42 U.S.C. § 1983 or Fed. R. Civ. P. 12(b)(6)
const STATUTE_CITATION_RE = /(\d+\s+U\.S\.C\.?\s*§\s*[\d\w\(\)]+(?:\s+\(\d{4}\))?|Fed\.\s*R\.\s*(?:Civ\.|Crim\.|Evid\.)\s*P\.\s*[\d\w\(\)\.]+)/g;

// Strategic signal phrases
const STRATEGY_PHRASES = [
  /\bfile\s+(a\s+)?(motion|MTD|MSJ|brief|complaint)\b/i,
  /\bargue\s+(that\s+)?/i,
  /\bchallenge\s+(the\s+)?/i,
  /\bground[s]?\s+(for\s+)?/i,
  /\brecommend\s+(filing|arguing|challenging)\b/i,
  /\bstrongest\s+(argument|ground|basis)\b/i,
];

// Open question signals
const OPEN_QUESTION_PHRASES = [
  /\b(verify|confirm|check|unclear|unresolved|needs?\s+(verification|confirmation|research))\b/i,
  /\[VERIFY[:\s]/i,
  /\bcircuit\s+split\b/i,
  /\b(may|might)\s+need\s+to\b/i,
];

// ── ARES v5 shadow JSON ──────────────────────────────────────────────────
// Matches a fenced ```json ... ``` block (last one wins). Schema validated after parse.
const SHADOW_BLOCK_RE = /```json\s*([\s\S]*?)\s*```/g;

// AresShadow types live in lib/ares/shadow-schema (canonical, strict).
// Re-exported so callers importing from this module continue to work unchanged.
export type { AresShadow, AresShadowCite };

export function parseAresShadow(text: string): AresShadow | null {
  SHADOW_BLOCK_RE.lastIndex = 0;
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = SHADOW_BLOCK_RE.exec(text)) !== null) {
    last = m[1];
  }
  if (!last) return null;
  try {
    const obj = JSON.parse(last);
    return isAresShadow(obj) ? obj : null;
  } catch {
    return null;
  }
}

function inferCourtTier(courtStr: string): CourtTier {
  const c = courtStr.toLowerCase();
  if (c.includes("supreme court") && (c.includes("u.s") || !c.includes("state"))) return "scotus";
  if (c.includes("cir.") || c.includes("circuit")) return "circuit";
  if (c.includes("d.") || c.includes("dist.") || c.includes("district")) return "district";
  if (c.includes("supreme")) return "state-high";
  return "unknown";
}

function shadowAuthorityKind(t: AresShadowCite["type"]): AuthorityKind {
  switch (t) {
    case "statute": return "statute";
    case "reg": return "regulation";
    case "rule": return "rule";
    case "case":
    case "secondary":
    default: return "case";
  }
}

function shadowConfidenceBucket(p: number | undefined): Confidence {
  if (typeof p !== "number") return 2;
  if (p >= 0.85) return 3;
  if (p >= 0.6) return 2;
  return 1;
}

function slugify(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase().substring(0, 60);
}

// Deterministic ID from content (so same citation across calls = same node)
function stableId(prefix: string, content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  return `${prefix}_${Math.abs(hash).toString(36)}`;
}

// Build a verified authority node from CourtListener-confirmed citation.
// Use from citations page to promote a verified citation into LexMemory.
export function authorityFromVerified(args: {
  citation: string;
  caseName?: string;
  court?: string;
  tab: TabId;
}): Level3Authority {
  const shortCite = (args.caseName ?? args.citation).substring(0, 40);
  const tier = inferCourtTier(args.court ?? args.citation);
  return {
    kind: "authority",
    id: stableId("auth", args.citation),
    citation: args.citation,
    shortCite,
    authorityKind: "case",
    courtTier: tier,
    verified: true,
    confirmedBy: [args.tab],
    lastRefAt: Date.now(),
    confidence: 3,
  };
}

export function extractDelta(responseText: string, tab: TabId): LexMemoryDelta {
  const now = Date.now();
  const nodes: LexMemoryDelta["nodes"] = [];
  const seenIds = new Set<string>();

  const shadow = parseAresShadow(responseText);

  // ── Path A: shadow-driven (ARES v5+) ─────────────────────────────────────
  if (shadow) {
    // Cites → Level3Authority. Higher fidelity than regex (carries confidence + subsequent_history).
    for (const c of shadow.cites ?? []) {
      if (!c?.raw) continue;
      const citation = c.raw.trim();
      const id = stableId("auth", citation);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const verified = c.verified_via === "cite_verify" || c.verified_via === "cite_lookup";
      nodes.push({
        kind: "authority",
        id,
        citation,
        shortCite: citation.substring(0, 40),
        authorityKind: shadowAuthorityKind(c.type),
        courtTier: c.type === "case" ? inferCourtTier(citation) : "unknown",
        proposition: undefined,
        verified,
        confirmedBy: [tab],
        lastRefAt: now,
        confidence: shadowConfidenceBucket(c.confidence),
      } satisfies Level3Authority);
    }

    // Counterarguments addressed → Level3Strategy (one entry per addressed rebuttal).
    for (const ca of shadow.counterarguments ?? []) {
      if (!ca?.our_response) continue;
      const detail = `${ca.oc_position} → ${ca.our_response}`.substring(0, 200);
      const id = stableId("strat", detail);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      nodes.push({
        kind: "strategy",
        id,
        label: slugify(`oc_rebuttal_${ca.oc_position.substring(0, 30)}`),
        detail,
        confirmedBy: [tab],
        lastRefAt: now,
        confidence: ca.addressed ? 2 : 1,
      } satisfies Level3Strategy);
    }

    // Holdings as strategic stance (one per holding favorable to client).
    for (const h of shadow.holdings ?? []) {
      if (!h?.rule) continue;
      const detail = `${h.rule} (${h.outcome_for_client ?? "unsettled"})`.substring(0, 200);
      const id = stableId("strat", `holding_${h.issue}_${detail}`);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      nodes.push({
        kind: "strategy",
        id,
        label: slugify(`holding_${h.issue}_${h.outcome_for_client ?? "x"}`),
        detail,
        confirmedBy: [tab],
        lastRefAt: now,
        confidence: 2,
      } satisfies Level3Strategy);
    }

    // Issues + open flags → Level3OpenQuestion. Blocking on VERIFY / CIRCUIT_SPLIT / UNSETTLED.
    const blockingFlags = new Set(["VERIFY", "CIRCUIT SPLIT", "UNSETTLED"]);
    for (const flag of shadow.flags ?? []) {
      const blocking = blockingFlags.has(flag);
      const id = stableId("open", `${flag}_${tab}`);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      nodes.push({
        kind: "open",
        id,
        question: `[${flag}] flagged in ${tab}`,
        blocking,
        raisedBy: tab,
        raisedAt: now,
      } satisfies Level3OpenQuestion);
    }

    for (const cs of shadow.circuit_splits ?? []) {
      if (!cs?.topic) continue;
      const id = stableId("open", `csplit_${cs.topic}`);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      nodes.push({
        kind: "open",
        id,
        question: `Circuit split: ${cs.topic}`.substring(0, 100),
        blocking: true,
        raisedBy: tab,
        raisedAt: now,
      } satisfies Level3OpenQuestion);
    }

    for (const iq of shadow.issues ?? []) {
      if (!iq?.question) continue;
      const id = stableId("open", `issue_${iq.id}_${iq.question}`);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      nodes.push({
        kind: "open",
        id,
        question: iq.question.substring(0, 100),
        blocking: false,
        raisedBy: tab,
        raisedAt: now,
      } satisfies Level3OpenQuestion);
    }
  }

  // ── Path B: regex backstop (always runs, dedupes against shadow) ─────────
  // Keeps v3 responses fully extractable AND catches anything ARES omits from the shadow.
  let match: RegExpExecArray | null;
  CASE_CITATION_RE.lastIndex = 0;
  while ((match = CASE_CITATION_RE.exec(responseText)) !== null) {
    const [, caseName, reporter, courtYear] = match;
    const citation = `${caseName.trim()}, ${reporter.trim()} (${courtYear.trim()})`;
    const id = stableId("auth", citation);
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const tier = inferCourtTier(courtYear);
    nodes.push({
      kind: "authority",
      id,
      citation,
      shortCite: caseName.trim().substring(0, 40),
      authorityKind: "case",
      courtTier: tier,
      verified: false,
      confirmedBy: [tab],
      lastRefAt: now,
      confidence: 2,
    } satisfies Level3Authority);
  }

  STATUTE_CITATION_RE.lastIndex = 0;
  while ((match = STATUTE_CITATION_RE.exec(responseText)) !== null) {
    const citation = match[0].trim();
    const id = stableId("auth", citation);
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    nodes.push({
      kind: "authority",
      id,
      citation,
      shortCite: citation.substring(0, 40),
      authorityKind: "statute",
      courtTier: "unknown",
      verified: false,
      confirmedBy: [tab],
      lastRefAt: now,
      confidence: 2,
    } satisfies Level3Authority);
  }

  // Only run regex strategy/open extraction if shadow didn't already populate them.
  // Avoids duplicating noisier regex hits when high-quality shadow signals exist.
  const shadowHadStrategy = !!shadow && ((shadow.counterarguments?.length ?? 0) + (shadow.holdings?.length ?? 0) > 0);
  if (!shadowHadStrategy) {
    for (const re of STRATEGY_PHRASES) {
      const stratMatch = re.exec(responseText);
      if (!stratMatch) continue;
      const start = Math.max(0, stratMatch.index - 80);
      const end = Math.min(responseText.length, stratMatch.index + 120);
      const sentence = responseText.slice(start, end).replace(/\n+/g, " ").trim();
      const id = stableId("strat", sentence);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      nodes.push({
        kind: "strategy",
        id,
        label: slugify(sentence.substring(0, 40)),
        detail: sentence.substring(0, 120),
        confirmedBy: [tab],
        lastRefAt: now,
        confidence: 1,
      } satisfies Level3Strategy);
      break;
    }
  }

  const shadowHadOpen = !!shadow && ((shadow.flags?.length ?? 0) + (shadow.circuit_splits?.length ?? 0) + (shadow.issues?.length ?? 0) > 0);
  if (!shadowHadOpen) {
    for (const re of OPEN_QUESTION_PHRASES) {
      const openMatch = re.exec(responseText);
      if (!openMatch) continue;
      const start = Math.max(0, openMatch.index);
      const end = Math.min(responseText.length, openMatch.index + 100);
      const question = responseText.slice(start, end).replace(/\n+/g, " ").trim().substring(0, 100);
      const blocking = /\[VERIFY|circuit\s+split/i.test(question);
      const id = stableId("open", question);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      nodes.push({
        kind: "open",
        id,
        question,
        blocking,
        raisedBy: tab,
        raisedAt: now,
      } satisfies Level3OpenQuestion);
      break;
    }
  }

  // L2 episode summary — prefer ARES bottom_line when available; else caveman compress the prose.
  const proseForSummary = shadow?.bottom_line
    ? shadow.bottom_line.substring(0, 400)
    : cavemanCompress(
        responseText
          // Strip the shadow JSON block before summarizing to avoid summary = JSON.
          .replace(SHADOW_BLOCK_RE, "")
          .slice(0, 400)
          .replace(/#+\s*/g, "")
          .replace(/\*+/g, "")
          .trim()
      ).substring(0, 400);

  const episode: Level2Episode = {
    id: `ep_${tab}_${now}`,
    tab,
    date: new Date(now).toISOString().substring(0, 10),
    summary: proseForSummary,
    derivedNodeIds: nodes.map(n => n.id),
    createdAt: now,
  };

  const raw: Level1Raw = {
    id: `raw_${tab}_${now}`,
    tab,
    text: responseText.substring(0, 2000),
    createdAt: now,
  };

  return { nodes, episode, raw };
}
