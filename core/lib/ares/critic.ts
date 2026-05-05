// ARES v6 — Evaluator-Optimizer critic loop.
// Scores a final ARES draft against the v5/v6 ship-gate rubric. If the draft
// fails a hard rule (prohibited phrase, missing BOTTOM LINE, overall < threshold),
// runs ONE optimizer pass to revise the draft, then re-scores it.
//
// Always routes through critic-llm.ts → 9-LLM waterfall (zero Haiku spend).
// LITE mode skips critic entirely (Risk #1: shadow JSON regresses prose
// quality under multi-attention pressure on small models).
//
// Hard cap: 1 revision per call. Never loops.
//
// Plan: ~/.claude/plans/jaunty-dazzling-horizon.md (rows 143, 194, 209)
// Ship gates: hallucinated cites/100 ≤ 2, counterarg coverage ≥ 70% v5 / ≥ 85% v6,
//             BOTTOM LINE 100%, Brier ≤ 0.20.
//
// Wiring (deferred): with-lex-memory.ts will optionally invoke `aresCritic()`
// after the model returns, populate `criticScore` on the usage row, and surface
// `revised_draft` to the page when present. Not done in this commit.
//
// Public surface:
//   aresCritic(input) → CriticOutput
//   PROHIBITED_PATTERNS — exported for tests / admin observability

import { critic, criticJson } from "./critic-llm";
import type { AresMode, AresPosture, AresShadow } from "./shadow-schema";

// ── Hard-fail prohibited phrases ──────────────────────────────────────────
// These leak when small models drift into refusal/hedge boilerplate. Any
// single match flips `passed=false` regardless of rubric score.
export const PROHIBITED_PATTERNS: readonly RegExp[] = [
  /\bas an? AI (language\s+)?model\b/i,
  /\bI cannot provide legal advice\b/i,
  /\bI'?m not (a\s+)?(licensed\s+)?(attorney|lawyer)\b/i,
  /\bplease consult (a|an|with) (qualified\s+)?(attorney|lawyer|legal professional)\b/i,
  /\bI don'?t have (access to|the ability to)\b/i,
  /\bmy training data\b/i,
  /\bI cannot (browse|access) the internet\b/i,
] as const;

// ── Types ─────────────────────────────────────────────────────────────────

export interface CriticInput {
  draft: string;
  shadow?: AresShadow | null;
  mode?: AresMode | null;
  posture?: AresPosture | null;
  // System prompt the original draft was generated under. Used so the
  // optimizer revision keeps the same persona/voice. Optional — falls back
  // to a minimal ARES-aligned prompt.
  systemPrompt?: string;
  matterId?: string;
}

export interface CriticScore {
  overall: number;                       // 0–1, weighted across rubric
  cite_integrity: number;                // 0–1
  counterargument_coverage: number;      // 0–1
  bottom_line_present: boolean;
  prohibited_phrases: string[];          // matched substrings (capped 5)
  passed: boolean;                       // false if any hard rule fails
  notes: string[];                       // critic-supplied diagnostics, capped 6
}

export interface CriticOutput {
  score: CriticScore;
  revised_draft: string | null;          // null if no revision attempted
  revised_score: CriticScore | null;     // null when revised_draft is null
  skipped: boolean;                      // true for LITE mode or empty draft
  // Numeric digest persisted to ai_usage.critic_score. Uses revised score
  // when a revision was produced, otherwise the original score. Range 0–1.
  // Null when skipped.
  persisted_score: number | null;
}

// Raw rubric reply from the small model. We validate every field defensively.
interface RawRubric {
  cite_integrity?: number;
  counterargument_coverage?: number;
  bottom_line_present?: boolean;
  notes?: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────

const PASS_THRESHOLD = 0.7;       // overall ≥ 0.7 + no hard fails = passed
const MAX_DRAFT_CHARS = 16_000;   // refuse to revise drafts > 16k chars
const MAX_REVISION_INPUT = 12_000; // truncate to this much when revising
const RUBRIC_MAX_TOKENS = 420;
const REVISION_MAX_TOKENS = 2_400;

const RUBRIC_SYSTEM = `You are a rubric grader for legal-research drafts produced by an AI legal-research system (ARES).
Score the draft on each axis from 0.0 to 1.0. No commentary, no fences.

Schema: {"cite_integrity":<0..1>,"counterargument_coverage":<0..1>,"bottom_line_present":<bool>,"notes":[<short strings>]}

Definitions:
- cite_integrity: fraction of citations that look well-formed Bluebook (case: "Name v. Name, 123 F.3d 456 (Cir. Year)"; statute: "42 U.S.C. § 1983"; rule: "Fed. R. Civ. P. 12(b)(6)") AND appear plausibly real (no obviously fabricated reporters or volume numbers). 1.0 if no citations are present.
- counterargument_coverage: fraction of likely opposing-counsel rebuttals that the draft acknowledges or refutes. 1.0 if no adversarial posture is apparent.
- bottom_line_present: true iff the draft contains an explicit "BOTTOM LINE" section, "Recommendation:" header, or equivalent direct conclusion sentence in the final 25% of the text.
- notes: 1-6 short diagnostic strings. Empty if everything is fine.

Be conservative. If you cannot determine an axis, score 0.6 and add a note. Do not invent issues to pad notes.`;

// Revision prompt is short — the small-model attention budget is tight.
const REVISION_SYSTEM_FALLBACK = `You are ARES, a senior legal research assistant. Revise the prior draft to fix the listed issues. Preserve correct cites and structure. Output only the revised draft, no preamble, no fences.`;

// ── Public API ────────────────────────────────────────────────────────────

export async function aresCritic(input: CriticInput): Promise<CriticOutput> {
  const draft = (input.draft ?? "").trim();
  const mode = input.mode ?? input.shadow?.mode ?? null;

  // LITE mode never runs the critic — Risk #1.
  if (mode === "LITE" || !draft) {
    return emptyOutput(/* skipped */ true);
  }
  if (draft.length > MAX_DRAFT_CHARS) {
    // Score what we can but skip the revision pass for very long drafts —
    // small models truncate badly past their context window.
    const score = await scoreOrFallback(draft.slice(0, MAX_REVISION_INPUT), input);
    return {
      score,
      revised_draft: null,
      revised_score: null,
      skipped: false,
      persisted_score: score.overall,
    };
  }

  const score = await scoreOrFallback(draft, input);

  // Hard fail criteria → revise once.
  if (!score.passed) {
    const revised = await reviseOnce(draft, score, input);
    if (revised) {
      const revisedScore = await scoreOrFallback(revised, input);
      return {
        score,
        revised_draft: revised,
        revised_score: revisedScore,
        skipped: false,
        persisted_score: revisedScore.overall,
      };
    }
  }

  return {
    score,
    revised_draft: null,
    revised_score: null,
    skipped: false,
    persisted_score: score.overall,
  };
}

// ── Internals ─────────────────────────────────────────────────────────────

async function scoreOrFallback(draft: string, input: CriticInput): Promise<CriticScore> {
  // Local checks first — these are deterministic, no model call needed.
  const prohibited = matchProhibited(draft);
  const bottomLineLocal = detectBottomLine(draft, input.shadow);

  let cite = 0.6;
  let counter = 0.6;
  let modelBL = bottomLineLocal;
  let notes: string[] = [];

  try {
    const rubric = await criticJson<RawRubric>({
      system: RUBRIC_SYSTEM,
      user: buildRubricUser(draft, input),
      maxTokens: RUBRIC_MAX_TOKENS,
      toolName: "ares_critic_rubric",
      matterId: input.matterId,
    });
    cite = clamp01(rubric?.cite_integrity, 0.6);
    counter = clamp01(rubric?.counterargument_coverage, 0.6);
    if (typeof rubric?.bottom_line_present === "boolean") {
      modelBL = rubric.bottom_line_present || bottomLineLocal;
    }
    if (Array.isArray(rubric?.notes)) {
      notes = rubric.notes.slice(0, 6).map((s) => String(s).slice(0, 200));
    }
  } catch {
    // Waterfall unavailable — fall through with defensive defaults. We do
    // NOT mark the draft failed on infra errors; that would block every
    // ARES call when Groq/Cerebras hiccup.
    notes = ["critic-unavailable: waterfall returned no usable rubric"];
  }

  // Pull confidences from shadow JSON if present — they often beat the
  // small model's freshly-computed scores when the main model self-rated.
  if (input.shadow?.confidence) {
    const sCi = clamp01(input.shadow.confidence.citation_integrity, NaN);
    const sCa = clamp01(input.shadow.confidence.counterargument_coverage, NaN);
    if (!Number.isNaN(sCi)) cite = (cite + sCi) / 2;
    if (!Number.isNaN(sCa)) counter = (counter + sCa) / 2;
  }

  const overall = weightedOverall(cite, counter, modelBL);
  const passed = prohibited.length === 0 && modelBL && overall >= PASS_THRESHOLD;

  return {
    overall,
    cite_integrity: cite,
    counterargument_coverage: counter,
    bottom_line_present: modelBL,
    prohibited_phrases: prohibited,
    passed,
    notes,
  };
}

async function reviseOnce(
  draft: string,
  score: CriticScore,
  input: CriticInput,
): Promise<string | null> {
  const issues: string[] = [];
  if (score.prohibited_phrases.length > 0) {
    issues.push(`Remove disallowed boilerplate phrases: ${score.prohibited_phrases.slice(0, 3).join(", ")}`);
  }
  if (!score.bottom_line_present) {
    issues.push('Add an explicit "BOTTOM LINE:" section with a direct recommendation as the closing of the draft.');
  }
  if (score.cite_integrity < 0.7) {
    issues.push("Verify or remove citations that may be fabricated; keep only well-formed Bluebook references.");
  }
  if (score.counterargument_coverage < 0.7) {
    issues.push("Add a Devil's-Advocate / Anticipated Counterargument section addressing 2-3 strongest opposing positions.");
  }
  if (score.notes.length > 0) {
    issues.push(`Critic notes: ${score.notes.slice(0, 3).join(" | ")}`);
  }
  if (issues.length === 0) return null;

  const system = (input.systemPrompt && input.systemPrompt.length < 6000)
    ? input.systemPrompt
    : REVISION_SYSTEM_FALLBACK;

  const truncated = draft.length > MAX_REVISION_INPUT
    ? draft.slice(0, MAX_REVISION_INPUT)
    : draft;

  try {
    const revised = await critic({
      system,
      user: `Revise the following draft to fix these specific issues. Output only the revised draft.\n\nIssues:\n- ${issues.join("\n- ")}\n\nORIGINAL DRAFT:\n${truncated}`,
      maxTokens: REVISION_MAX_TOKENS,
      toolName: "ares_critic_revision",
      matterId: input.matterId,
    });
    const cleaned = revised.trim();
    return cleaned.length > 100 ? cleaned : null;
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function matchProhibited(draft: string): string[] {
  const hits: string[] = [];
  for (const re of PROHIBITED_PATTERNS) {
    const m = draft.match(re);
    if (m && m[0]) {
      hits.push(m[0].slice(0, 80));
      if (hits.length >= 5) break;
    }
  }
  return hits;
}

function detectBottomLine(draft: string, shadow: AresShadow | null | undefined): boolean {
  if (shadow?.bottom_line && shadow.bottom_line.trim().length > 0) return true;
  const tail = draft.slice(Math.max(0, Math.floor(draft.length * 0.6)));
  return /\bBOTTOM LINE\b/i.test(tail) || /\bRecommendation\s*:/i.test(tail);
}

function weightedOverall(cite: number, counter: number, bl: boolean): number {
  // Citation integrity is the biggest hallucination risk → weight it highest.
  // Mata v. Avianca is the doomsday scenario for v6.
  const blScore = bl ? 1 : 0;
  const overall = 0.5 * cite + 0.3 * counter + 0.2 * blScore;
  return clamp01(overall, 0);
}

function clamp01(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function buildRubricUser(draft: string, input: CriticInput): string {
  const ctx: string[] = [];
  if (input.posture) ctx.push(`Posture: ${input.posture}`);
  if (input.shadow?.jurisdiction?.court) ctx.push(`Court: ${input.shadow.jurisdiction.court}`);
  if (input.shadow?.cites?.length) ctx.push(`Shadow-reported cite count: ${input.shadow.cites.length}`);
  const head = ctx.length ? `Context:\n${ctx.join("\n")}\n\n` : "";
  return `${head}Draft to grade:\n${draft.slice(0, MAX_REVISION_INPUT)}\n\nReturn JSON.`;
}

function emptyOutput(skipped: boolean): CriticOutput {
  return {
    score: {
      overall: 1,
      cite_integrity: 1,
      counterargument_coverage: 1,
      bottom_line_present: true,
      prohibited_phrases: [],
      passed: true,
      notes: [],
    },
    revised_draft: null,
    revised_score: null,
    skipped,
    persisted_score: skipped ? null : 1,
  };
}
