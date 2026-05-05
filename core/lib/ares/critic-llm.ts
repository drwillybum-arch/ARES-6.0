// ARES v6 — small-model critic wrapper.
// Calls the existing Anthropic-shaped proxy in apps/api. The proxy already
// runs a 9-provider waterfall (groq, cerebras, sambanova, openrouter, nvidia,
// xai, mistral, gemini, gemini-2). When `model` contains "haiku" the proxy
// maps to the small-model tier (llama-3.1-8b on Groq/Cerebras, gemini-flash,
// etc.) — free for admin/free-tier requests, cheap-or-free for everyone else.
//
// This means v6 wave B handlers (posture_detect, ethics_check, plan_check)
// can run a fast classifier-style model with zero incremental Haiku spend.
//
// Plan: ~/.claude/plans/jaunty-dazzling-horizon.md

import { tryProviders } from "./waterfall";

// Pin a haiku-class identifier so the waterfall routes through small models.
export const ARES_CRITIC_MODEL = "claude-haiku-4-5-20251001";

export interface CriticOpts {
  system: string;
  user: string;
  maxTokens?: number;
  toolName?: string;
  matterId?: string;
}

export async function critic(opts: CriticOpts): Promise<string> {
  const res = await tryProviders({
    messages: [{ role: "user", content: opts.user }],
    system: opts.system,
    max_tokens: opts.maxTokens ?? 800,
    model: ARES_CRITIC_MODEL
  });
  const json = await res.json() as any;
  return json.content?.[0]?.text ?? "";
}

// Strict-JSON variant. Strips ```json fences and pulls the first balanced
// object. Throws on parse failure so callers can fall back to defaults.
export async function criticJson<T>(opts: CriticOpts): Promise<T> {
  const text = await critic(opts);
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("ARES critic: no JSON object in response");

  // Walk forward tracking depth so we tolerate trailing prose.
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "\"") inStr = false;
      continue;
    }
    if (ch === "\"") inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(cleaned.slice(start, i + 1)) as T;
      }
    }
  }
  throw new Error("ARES critic: unbalanced JSON in response");
}
