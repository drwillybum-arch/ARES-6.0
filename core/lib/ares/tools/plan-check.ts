// ARES v6 — plan_check tool.
// Validate a Plan-then-Execute numbered plan: completeness, missing steps,
// rough token estimate. Runs on the small-model row of the 9-LLM waterfall.
//
// Plan: ~/.claude/plans/jaunty-dazzling-horizon.md

import { criticJson } from "../critic-llm";
import type { PlanCheckInput, PlanCheckOutput } from "./types";

const SYSTEM = `You are a planning critic for legal-research workflows.
Evaluate the numbered plan against this rubric:
- Does it cover INTAKE → FRAME → RESEARCH → REASON → DRAFT → VERIFY → DELIVER?
- Are jurisdiction, posture, and controlling authority addressed before the rule synthesis?
- Are counterarguments and a verification step present?
- Is BOTTOM LINE reachable?

Output ONLY a JSON object, no commentary, no fences.
Schema: {"complete":<bool>,"missing_steps":[<short strings>],"estimated_tokens":<integer>}

estimated_tokens: rough (200-4000) estimate of the assistant's full response if executing this plan.`;

function fallback(plan: string[]): PlanCheckOutput {
  const tokenEstimate = Math.min(4000, Math.max(400, plan.length * 250));
  return { complete: plan.length >= 5, missing_steps: [], estimated_tokens: tokenEstimate };
}

export async function planCheck(input: PlanCheckInput): Promise<PlanCheckOutput> {
  if (!Array.isArray(input?.plan) || input.plan.length === 0) {
    return { complete: false, missing_steps: ["Plan is empty"], estimated_tokens: 0 };
  }
  const numbered = input.plan
    .slice(0, 20)
    .map((s, i) => `${i + 1}. ${String(s).slice(0, 200)}`)
    .join("\n");

  try {
    const out = await criticJson<PlanCheckOutput>({
      system: SYSTEM,
      user: `Numbered plan:\n${numbered}\n\nReturn JSON.`,
      maxTokens: 280,
      toolName: "ares_plan_check",
    });
    if (!out) return fallback(input.plan);
    return {
      complete: !!out.complete,
      missing_steps: Array.isArray(out.missing_steps) ? out.missing_steps.slice(0, 6) : [],
      estimated_tokens: typeof out.estimated_tokens === "number" && out.estimated_tokens > 0
        ? Math.min(8000, Math.round(out.estimated_tokens))
        : fallback(input.plan).estimated_tokens,
    };
  } catch {
    return fallback(input.plan);
  }
}
