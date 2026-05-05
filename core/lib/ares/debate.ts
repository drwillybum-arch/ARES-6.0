// ARES v6 — multi-agent debate orchestrator.
// Three sequential small-model calls on the 9-LLM waterfall:
//   1. Movant      — strongest affirmative case for the moving party.
//   2. Respondent  — strongest rebuttal, using matter facts + movant's argument.
//   3. Judge       — neutral synthesis, predicted outcome + confidence.
//
// Triggered when shadow JSON / matter posture is "msj" or "appeal" — the two
// adversarial postures where dialectic improves analysis quality. For other
// postures the orchestrator returns `skipped:true` immediately.
//
// All three calls go through critic-llm.ts → free waterfall (no Haiku spend).
// Sequential, not parallel: respondent reads movant's argument, judge reads both.
// Latency budget: ~3-6s wall-clock (small-model tier). Tolerated because debate
// only fires on MSJ/appeal, where users already accept "Deep Research" timing.
//
// Plan: ~/.claude/plans/jaunty-dazzling-horizon.md (rows 144, 210)
// Wiring (deferred): a feature page (Strategy or Deep Research) calls
// `aresDebate()` after posture_detect returns msj/appeal, then injects the
// three rounds + judge synthesis into the system prompt of the main ARES call.

import { critic, criticJson } from "./critic-llm";
import type { AresPosture } from "./shadow-schema";

// ── Types ─────────────────────────────────────────────────────────────────

export interface DebateInput {
  question: string;            // legal question / motion at bar
  facts: string;               // matter facts / record summary
  posture: AresPosture;
  jurisdiction?: string;
  controlling_authority?: string;
  matterId?: string;
}

export type DebateRole = "movant" | "respondent" | "judge";

export interface DebateRound {
  role: DebateRole;
  argument: string;            // full prose, capped ~1.6k chars
  key_points: string[];        // 3-5 bullets, ≤ 200 chars each
}

export type DebateOutcome = "movant" | "respondent" | "split" | "uncertain";

export interface DebateOutput {
  posture: AresPosture;
  rounds: DebateRound[];               // ordered: movant, respondent, judge
  predicted_outcome: DebateOutcome;
  confidence: number;                  // 0-1
  reasoning: string;                   // judge's reasoning summary
  skipped: boolean;                    // true when posture not msj/appeal
  partial: boolean;                    // true if any call failed/short-circuited
}

// Internal raw shape from criticJson — all fields validated before use.
interface RawJudgeVerdict {
  predicted_outcome?: string;
  confidence?: number;
  reasoning?: string;
  key_points?: string[];
}

interface RawArgument {
  argument?: string;
  key_points?: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────

const MAX_FACTS = 6_000;
const MAX_QUESTION = 1_500;
const ARG_MAX_TOKENS = 900;
const JUDGE_MAX_TOKENS = 700;
const ARG_MAX_CHARS = 1_600;
const POINTS_CAP = 5;
const POINT_MAX_CHARS = 200;

// ── Public API ────────────────────────────────────────────────────────────

export async function aresDebate(input: DebateInput): Promise<DebateOutput> {
  if (input.posture !== "msj" && input.posture !== "appeal") {
    return skippedOutput(input.posture);
  }
  if (!input.question?.trim() || !input.facts?.trim()) {
    return skippedOutput(input.posture);
  }

  const ctx = buildContext(input);
  const movantLabel = input.posture === "appeal" ? "appellant" : "movant";
  const respondentLabel = input.posture === "appeal" ? "appellee" : "non-movant";

  // Round 1 — movant.
  const movant = await runArgument({
    role: "movant",
    label: movantLabel,
    instruction: argumentInstruction(input.posture, "movant", movantLabel),
    user: `${ctx}\n\nWrite the strongest argument FOR the ${movantLabel}. Return JSON.`,
    matterId: input.matterId,
  });

  // Round 2 — respondent (sees movant's argument).
  const respondent = await runArgument({
    role: "respondent",
    label: respondentLabel,
    instruction: argumentInstruction(input.posture, "respondent", respondentLabel),
    user: `${ctx}\n\n${movantLabel.toUpperCase()}'S ARGUMENT:\n${movant.argument}\n\nWrite the strongest rebuttal FOR the ${respondentLabel}. Address the ${movantLabel}'s key points head-on. Return JSON.`,
    matterId: input.matterId,
  });

  // Round 3 — judge synthesis (sees both arguments).
  const judge = await runJudge(input, movant, respondent, movantLabel, respondentLabel);

  const partial =
    movant.argument.length < 100 ||
    respondent.argument.length < 100 ||
    judge.reasoning.length < 50;

  return {
    posture: input.posture,
    rounds: [
      { role: "movant", argument: movant.argument, key_points: movant.key_points },
      { role: "respondent", argument: respondent.argument, key_points: respondent.key_points },
      { role: "judge", argument: judge.reasoning, key_points: judge.key_points },
    ],
    predicted_outcome: judge.predicted_outcome,
    confidence: judge.confidence,
    reasoning: judge.reasoning,
    skipped: false,
    partial,
  };
}

// ── Internals ─────────────────────────────────────────────────────────────

interface ArgumentResult {
  argument: string;
  key_points: string[];
}

async function runArgument(opts: {
  role: DebateRole;
  label: string;
  instruction: string;
  user: string;
  matterId?: string;
}): Promise<ArgumentResult> {
  try {
    const raw = await criticJson<RawArgument>({
      system: opts.instruction,
      user: opts.user,
      maxTokens: ARG_MAX_TOKENS,
      toolName: `ares_debate_${opts.role}`,
      matterId: opts.matterId,
    });
    return {
      argument: trimArg(raw?.argument),
      key_points: trimPoints(raw?.key_points),
    };
  } catch {
    // Waterfall failed for this round. Return a skeletal "no-argument"
    // result so the next round still has something to react to.
    return {
      argument: `[no ${opts.role} argument generated — waterfall unavailable]`,
      key_points: [],
    };
  }
}

interface JudgeResult {
  predicted_outcome: DebateOutcome;
  confidence: number;
  reasoning: string;
  key_points: string[];
}

async function runJudge(
  input: DebateInput,
  movant: ArgumentResult,
  respondent: ArgumentResult,
  movantLabel: string,
  respondentLabel: string,
): Promise<JudgeResult> {
  const system = `You are a neutral appellate-court judge synthesizing a pre-decision analysis. Read both arguments, weigh them under the controlling standard, and predict the most likely outcome. Be honest: if the case is close, say "split" or "uncertain". Do not favor either side.

Output ONLY JSON, no commentary, no fences.
Schema: {"predicted_outcome":"movant|respondent|split|uncertain","confidence":<0..1>,"reasoning":<2-4 sentence string>,"key_points":[<short strings>]}

Rules:
- predicted_outcome="movant" if the ${movantLabel} clearly carries the burden under the controlling standard.
- predicted_outcome="respondent" if the ${respondentLabel}'s rebuttal defeats the prima facie case.
- predicted_outcome="split" only when issues clearly resolve in opposite directions.
- predicted_outcome="uncertain" when the record/authority is too thin to predict.
- confidence: 0.0-1.0. Use 0.4-0.6 for genuine uncertainty.
- reasoning: cite the specific argument(s) that drove the prediction.
- key_points: 3-5 bullets the deciding judge would emphasize, ≤200 chars each.`;

  const user = `${buildContext(input)}

${movantLabel.toUpperCase()}'S ARGUMENT:
${movant.argument}

${movantLabel.toUpperCase()}'S KEY POINTS:
${movant.key_points.map((p, i) => `${i + 1}. ${p}`).join("\n") || "(none)"}

${respondentLabel.toUpperCase()}'S REBUTTAL:
${respondent.argument}

${respondentLabel.toUpperCase()}'S KEY POINTS:
${respondent.key_points.map((p, i) => `${i + 1}. ${p}`).join("\n") || "(none)"}

Issue the synthesis. Return JSON.`;

  try {
    const raw = await criticJson<RawJudgeVerdict>({
      system,
      user,
      maxTokens: JUDGE_MAX_TOKENS,
      toolName: "ares_debate_judge",
      matterId: input.matterId,
    });
    return {
      predicted_outcome: normalizeOutcome(raw?.predicted_outcome),
      confidence: clamp01(raw?.confidence, 0.5),
      reasoning: trimArg(raw?.reasoning).slice(0, 1_400) || "[no reasoning produced]",
      key_points: trimPoints(raw?.key_points),
    };
  } catch {
    // Final-round fallback — accept a non-JSON prose synthesis if criticJson
    // can't find a balanced object. Better than no judge at all.
    try {
      const prose = await critic({
        system,
        user,
        maxTokens: JUDGE_MAX_TOKENS,
        toolName: "ares_debate_judge_fallback",
        matterId: input.matterId,
      });
      return {
        predicted_outcome: "uncertain",
        confidence: 0.4,
        reasoning: prose.trim().slice(0, 1_400) || "[no reasoning produced]",
        key_points: [],
      };
    } catch {
      return {
        predicted_outcome: "uncertain",
        confidence: 0.3,
        reasoning: "[debate judge unavailable — waterfall returned no usable response]",
        key_points: [],
      };
    }
  }
}

function argumentInstruction(posture: AresPosture, role: DebateRole, label: string): string {
  const surface = posture === "appeal" ? "appellate court" : "trial court";
  return `You are zealous counsel for the ${label} in a ${posture.toUpperCase()} proceeding before a ${surface}. Make the strongest argument the record supports. Cite controlling authority where evident. Do not concede issues unnecessarily. Do not invent facts or citations.

Output ONLY JSON, no commentary, no fences.
Schema: {"argument":<2-4 paragraphs>,"key_points":[<3-5 short strings, ≤200 chars each>]}

Rules:
- argument: prose, ≤ ${ARG_MAX_CHARS} chars. Lead with the strongest theory. Anticipate the opponent if you are the ${role === "movant" ? "movant" : "respondent"}.
- key_points: 3-5 bullets a clerk would brief to the judge.`;
}

function buildContext(input: DebateInput): string {
  const lines: string[] = [];
  lines.push(`Posture: ${input.posture}`);
  if (input.jurisdiction) lines.push(`Jurisdiction: ${input.jurisdiction}`);
  if (input.controlling_authority) lines.push(`Controlling authority: ${input.controlling_authority}`);
  lines.push("");
  lines.push("Question presented:");
  lines.push(input.question.slice(0, MAX_QUESTION).trim());
  lines.push("");
  lines.push("Matter facts / record summary:");
  lines.push(input.facts.slice(0, MAX_FACTS).trim());
  return lines.join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────

function normalizeOutcome(v: unknown): DebateOutcome {
  if (typeof v !== "string") return "uncertain";
  const norm = v.toLowerCase().trim();
  if (norm === "movant" || norm === "appellant") return "movant";
  if (norm === "respondent" || norm === "appellee" || norm === "non-movant") return "respondent";
  if (norm === "split" || norm === "mixed") return "split";
  return "uncertain";
}

function clamp01(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function trimArg(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t.length > ARG_MAX_CHARS ? t.slice(0, ARG_MAX_CHARS) : t;
}

function trimPoints(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, POINTS_CAP)
    .map((s) => String(s).slice(0, POINT_MAX_CHARS).trim())
    .filter((s) => s.length > 0);
}

function skippedOutput(posture: AresPosture): DebateOutput {
  return {
    posture,
    rounds: [],
    predicted_outcome: "uncertain",
    confidence: 0,
    reasoning: "",
    skipped: true,
    partial: false,
  };
}
