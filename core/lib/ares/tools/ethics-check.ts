// ARES v6 — ethics_check tool.
// Constitutional-AI walkthrough on a Model Rules constitution. Runs on the
// small-model row of the 9-LLM waterfall (free).
//
// Plan: ~/.claude/plans/jaunty-dazzling-horizon.md

import { criticJson } from "../critic-llm";
import type { EthicsCheckInput, EthicsCheckOutput } from "./types";

const CONSTITUTION = `Model Rules of Professional Conduct (ABA, with state variations).
Key rules to evaluate:
- 1.1 Competence; 1.3 Diligence
- 1.6 Confidentiality of Information
- 1.7 / 1.9 Conflicts of Interest (current/former clients)
- 3.1 Meritorious Claims; 3.3 Candor Toward the Tribunal; 3.4 Fairness to Opposing Party; 3.5 Impartiality
- 4.1 Truthfulness; 4.2 No-Contact Rule; 4.3 Dealing with Unrepresented Persons
- 5.5 Unauthorized Practice; 7.1-7.3 Solicitation
- 8.4(c) Dishonesty / Fraud / Deceit / Misrepresentation
Bluebook 22nd ed. Rule 18.3 governs disclosure of generative AI assistance.`;

const SYSTEM = `You are an ethics auditor evaluating proposed attorney actions against the Model Rules of Professional Conduct.
${CONSTITUTION}

Output ONLY a JSON object, no commentary, no fences.
Schema: {"rules_implicated":[<rule numbers like "3.3","8.4(c)">],"severity":"ok|modify|decline","permissible_alternative":<short string>}

Rules for severity:
- "ok" — no rule implicated, action is permissible as-described
- "modify" — implicated but curable with disclosure, consent, or scope change
- "decline" — categorically prohibited (fabrication, ex parte contact with represented party, knowing false statement to tribunal, conflict that cannot be waived)

permissible_alternative: ALWAYS provide a short concrete next-step the attorney can take that is compliant. Even when severity is "ok", suggest a best-practice safeguard.`;

function fallback(action: string): EthicsCheckOutput {
  return {
    rules_implicated: [],
    severity: "modify",
    permissible_alternative: `Ethics review unavailable. Manually verify ${action.slice(0, 60)} against MRPC 1.1, 3.3, 8.4(c) before proceeding.`,
  };
}

export async function ethicsCheck(input: EthicsCheckInput): Promise<EthicsCheckOutput> {
  if (!input?.action?.trim()) return fallback("the proposed action");
  try {
    const out = await criticJson<EthicsCheckOutput>({
      system: SYSTEM,
      user: `Jurisdiction: ${input.jurisdiction || "(unspecified — assume ABA Model Rules)"}\n\nProposed action:\n${input.action.slice(0, 4000)}\n\nReturn JSON.`,
      maxTokens: 400,
      toolName: "ares_ethics_check",
    });
    if (!out || !out.severity) return fallback(input.action);
    return {
      rules_implicated: Array.isArray(out.rules_implicated) ? out.rules_implicated.slice(0, 8) : [],
      severity: out.severity === "ok" || out.severity === "modify" || out.severity === "decline" ? out.severity : "modify",
      permissible_alternative: typeof out.permissible_alternative === "string" && out.permissible_alternative.trim()
        ? out.permissible_alternative
        : "Pause and consult supervising counsel before proceeding.",
    };
  } catch {
    return fallback(input.action);
  }
}
