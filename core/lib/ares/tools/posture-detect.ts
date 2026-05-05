// ARES v6 — posture_detect tool.
// Classify the procedural posture of a matter from a short fact summary.
// Runs on the small-model row of the 9-LLM waterfall (free).
//
// Plan: ~/.claude/plans/jaunty-dazzling-horizon.md

import { criticJson } from "../critic-llm";
import type { PostureDetectInput, PostureDetectOutput } from "./types";

const SYSTEM = `You are a procedural-posture classifier for U.S. litigation matters.
Output ONLY a JSON object on a single line, no commentary, no fences.
Schema: {"posture":"pre-lit|pleadings|discovery|msj|trial|appeal","confidence":<0..1>,"deadlines_implied":[<short strings>]}
Rules:
- pre-lit: no complaint filed yet
- pleadings: complaint filed, before discovery cut
- discovery: discovery open or in progress
- msj: dispositive motion practice
- trial: trial set or in progress
- appeal: notice of appeal filed or briefing
- deadlines_implied: 0-3 short strings naming docket events implied by the facts (e.g. "Rule 26(f) conference", "answer due", "summary judgment briefing")`;

function fallback(): PostureDetectOutput {
  return { posture: "pleadings", confidence: 0.3, deadlines_implied: [] };
}

export async function postureDetect(input: PostureDetectInput): Promise<PostureDetectOutput> {
  if (!input?.matter_facts?.trim()) return fallback();
  try {
    const out = await criticJson<PostureDetectOutput>({
      system: SYSTEM,
      user: `Matter facts:\n${input.matter_facts.slice(0, 4000)}\n\nReturn JSON.`,
      maxTokens: 220,
      toolName: "ares_posture_detect",
    });
    if (!out?.posture) return fallback();
    return {
      posture: out.posture,
      confidence: typeof out.confidence === "number" ? Math.max(0, Math.min(1, out.confidence)) : 0.5,
      deadlines_implied: Array.isArray(out.deadlines_implied) ? out.deadlines_implied.slice(0, 5) : [],
    };
  } catch {
    return fallback();
  }
}
