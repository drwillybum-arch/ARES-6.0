// ARES v6 — subsequent-history detector ("good law" check).
// Practical JS substitute for eyecite's history extraction. Two layers:
//
//   1. LOCAL CONTEXT — scans prose near the cite for Bluebook signal phrases
//      ("overruled by", "abrogated by", "rev'd", "distinguished", "questioned
//      in"). Cheap, no network. Catches the case where the *drafter* knows
//      the history and expressed it in the surrounding text.
//
//   2. COURTLISTENER CITED-BY — searches CL for opinions citing the target,
//      pulls snippets, scans for negative-treatment phrases referencing the
//      target's reporter or short name. Real KeyCite-style signal.
//
// Conservative thresholding (Plan Risk #4):
//   - Only return "overruled" on at least one "overruled by" / "abrogated by"
//     hit in CL OR in the local context. False negatives are safer than
//     false positives — "overruled" strips a cite from output entirely.
//   - "distinguished" is advisory only; surfaces in shadow JSON but does
//     not affect the [GOOD LAW] flag in the prompt.
//   - "ok" requires no negative hits across both layers AND at least one
//     positive citation in CL. Otherwise "unknown".
//
// Plan: ~/.claude/plans/jaunty-dazzling-horizon.md (rows 196, 252)
// DEVLOG: 1.6.3 — eyecite JS port for true subsequent_history.

import { COURTLISTENER_BASE, getApiHeaders } from "../../api";
import type { SubsequentHistory } from "../shadow-schema";

// ── Signal phrases ────────────────────────────────────────────────────────
// Each list ordered by severity. Order within a class is significant only
// for which phrase we record — the detection is binary per class.

const OVERRULED_PHRASES: readonly RegExp[] = [
  /\boverruled\s+by\b/i,
  /\babrogated\s+by\b/i,
  /\brejected\s+by\b/i,
  /\bsuperseded\s+by\s+(statute|rule)\b/i,
  /\bno\s+longer\s+good\s+law\b/i,
];

const DISTINGUISHED_PHRASES: readonly RegExp[] = [
  /\bdistinguished\s+by\b/i,
  /\bdistinguished\s+in\b/i,
  /\bquestioned\s+in\b/i,
  /\bcriticized\s+in\b/i,
  /\bdisagreed\s+with\b/i,
  /\bnarrowed\s+by\b/i,
];

const REVERSAL_PHRASES: readonly RegExp[] = [
  /\brev'?d\s+(?:on\s+other\s+grounds\s+)?(?:by|sub\s+nom\.)?/i,
  /\breversed\s+(?:on\s+other\s+grounds\s+)?(?:by|sub\s+nom\.)?/i,
  /\bvacated\s+by\b/i,
];

// Positive treatment — used to lift confidence to "ok" only when no
// negative hits AND at least one of these appears in CL cited-by.
const POSITIVE_PHRASES: readonly RegExp[] = [
  /\bfollowed\s+(?:by|in)\b/i,
  /\baffirmed\s+(?:by|in)\b/i,
  /\bcited\s+(?:approvingly|favorably)\b/i,
];

// ── Public API ────────────────────────────────────────────────────────────

export interface HistoryInput {
  // Original Bluebook citation as written, e.g. "Roe v. Wade, 410 U.S. 113 (1973)".
  raw: string;
  // Optional reporter form, e.g. "410 U.S. 113". Used as the CL search query.
  reporterCite?: string;
  // Optional case short name for snippet scanning, e.g. "Roe".
  caseName?: string;
  // Optional surrounding prose from the drafter's document (≤ 2k chars).
  // Used by the LOCAL CONTEXT layer.
  context?: string;
}

export interface HistoryResult {
  status: SubsequentHistory;        // "overruled" | "distinguished" | "ok" | "unknown"
  evidence: string[];               // up to 3 short evidence strings
  source: "local" | "courtlistener" | "combined" | "none";
}

export async function detectSubsequentHistory(input: HistoryInput): Promise<HistoryResult> {
  const localFinding = scanLocalContext(input.context, input.caseName);

  // If local context already flags overruled, no need to hit CL.
  if (localFinding.status === "overruled") return localFinding;

  // CL cited-by lookup. Skip if we have nothing searchable.
  if (!input.reporterCite && !input.raw) {
    return localFinding.status !== "unknown" ? localFinding : noFinding();
  }

  let clFinding: HistoryResult;
  try {
    clFinding = await scanCourtListenerCitedBy(input.reporterCite ?? input.raw, input.caseName);
  } catch {
    // CL unavailable — degrade to local finding (or unknown).
    return localFinding;
  }

  return combine(localFinding, clFinding);
}

// ── Layer 1: local context ────────────────────────────────────────────────

function scanLocalContext(context: string | undefined, caseName: string | undefined): HistoryResult {
  if (!context) return noFinding();
  // Search a window around any mention of the case name. If no name, scan
  // the whole context — the drafter may have flagged history near the cite.
  const haystacks = caseName
    ? extractWindowsAround(context, caseName, 240)
    : [context.slice(0, 4000)];

  const evidence: string[] = [];
  let worst: SubsequentHistory = "unknown";

  for (const hay of haystacks) {
    if (anyMatch(hay, OVERRULED_PHRASES, evidence) || anyMatch(hay, REVERSAL_PHRASES, evidence)) {
      worst = "overruled";
    } else if (worst !== "overruled" && anyMatch(hay, DISTINGUISHED_PHRASES, evidence)) {
      worst = "distinguished";
    }
  }

  return {
    status: worst,
    evidence: evidence.slice(0, 3),
    source: worst === "unknown" ? "none" : "local",
  };
}

function extractWindowsAround(text: string, term: string, halfWindow: number): string[] {
  const re = new RegExp(escapeRegExp(term), "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = Math.max(0, m.index - halfWindow);
    const end = Math.min(text.length, m.index + term.length + halfWindow);
    out.push(text.slice(start, end));
    if (out.length >= 6) break;
  }
  return out.length > 0 ? out : [text.slice(0, 2000)];
}

// ── Layer 2: CourtListener cited-by ───────────────────────────────────────

interface CLSearchHit {
  caseName?: string;
  snippet?: string;
  dateFiled?: string;
  citation?: string[];
}

async function scanCourtListenerCitedBy(query: string, caseName?: string): Promise<HistoryResult> {
  // CL's main search supports phrase-querying for citations. We ask for
  // recent opinions that quote the citation itself; their snippets contain
  // the surrounding language including treatment phrases.
  const params = new URLSearchParams({
    q: `"${query}"`,
    type: "o",
    order_by: "dateFiled desc",
    page_size: "10",
  });
  const res = await fetch(`${COURTLISTENER_BASE}/search/?${params}`, {
    headers: getApiHeaders(),
  });
  if (!res.ok) throw new Error(`CL search failed: ${res.status}`);
  const data = await res.json() as { results?: CLSearchHit[] };
  const results = data.results ?? [];

  const evidence: string[] = [];
  let overruledHit = false;
  let distinguishedHit = false;
  let positiveHit = false;

  for (const hit of results) {
    const snippet = hit.snippet ?? "";
    if (!snippet) continue;
    // Only weigh a snippet if it actually mentions the target — CL's snippet
    // is the matched span context, but the same query can pull tangential
    // citations. The presence of the case short name boosts confidence.
    const mentionsTarget = caseName
      ? new RegExp(`\\b${escapeRegExp(caseName)}\\b`, "i").test(snippet)
      : true;
    if (!mentionsTarget) continue;

    if (anyMatch(snippet, OVERRULED_PHRASES, evidence) || anyMatch(snippet, REVERSAL_PHRASES, evidence)) {
      overruledHit = true;
    } else if (anyMatch(snippet, DISTINGUISHED_PHRASES, evidence)) {
      distinguishedHit = true;
    } else if (anyMatch(snippet, POSITIVE_PHRASES, evidence)) {
      positiveHit = true;
    }
  }

  if (overruledHit) return { status: "overruled", evidence: evidence.slice(0, 3), source: "courtlistener" };
  if (distinguishedHit) return { status: "distinguished", evidence: evidence.slice(0, 3), source: "courtlistener" };
  if (positiveHit && results.length >= 2) return { status: "ok", evidence: evidence.slice(0, 3), source: "courtlistener" };
  return noFinding();
}

// ── Combiner ──────────────────────────────────────────────────────────────

function combine(local: HistoryResult, cl: HistoryResult): HistoryResult {
  // Severity ranking: overruled > distinguished > ok > unknown.
  const rank = (s: SubsequentHistory): number => (
    s === "overruled" ? 3 : s === "distinguished" ? 2 : s === "ok" ? 1 : 0
  );
  if (rank(local.status) > rank(cl.status)) {
    return { ...local, source: cl.status === "unknown" ? local.source : "combined" };
  }
  if (rank(cl.status) > rank(local.status)) {
    return { ...cl, source: local.status === "unknown" ? cl.source : "combined" };
  }
  // Equal: merge evidence, prefer CL as source of truth.
  return {
    status: cl.status,
    evidence: [...cl.evidence, ...local.evidence].slice(0, 3),
    source: local.status === "unknown" && cl.status === "unknown" ? "none" : "combined",
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function anyMatch(text: string, patterns: readonly RegExp[], evidence: string[]): boolean {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      const start = Math.max(0, m.index - 40);
      const end = Math.min(text.length, m.index + (m[0]?.length ?? 0) + 60);
      evidence.push(text.slice(start, end).trim().slice(0, 180));
      return true;
    }
  }
  return false;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function noFinding(): HistoryResult {
  return { status: "unknown", evidence: [], source: "none" };
}
