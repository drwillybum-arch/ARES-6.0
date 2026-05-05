// ARES v6 — tool registry + dispatcher.
// Pure data + pure dispatcher: no Anthropic SDK coupling here. The 6 matter
// feature pages opt-in to v6 by passing an `aresTools` set, which
// withLexMemory will translate into Anthropic tool-use definitions when v6
// flips on. Today, the registry is the source of truth for tool schemas
// and runtime handlers.
//
// Plan: ~/.claude/plans/jaunty-dazzling-horizon.md

import { citeVerify } from "./cite-verify";
import { citeLookup } from "./cite-lookup";
import { postureDetect } from "./posture-detect";
import { ethicsCheck } from "./ethics-check";
import { planCheck } from "./plan-check";
import type {
  ToolDefinition,
  ToolName,
  CiteVerifyInput,
  CiteLookupInput,
  PostureDetectInput,
  EthicsCheckInput,
  PlanCheckInput,
} from "./types";

export const ARES_TOOLS: Record<ToolName, ToolDefinition> = {
  cite_verify: {
    name: "cite_verify",
    description:
      "Verify a Bluebook citation by parsing it, checking reporter/year/court plausibility, and resolving against CourtListener Citation-Lookup. Returns ok=true only when fully verified. Always invoke for any citation in DRAFT phase or any citation the model self-flags below 0.90 confidence.",
    input_schema: {
      type: "object",
      properties: {
        raw: { type: "string", description: "Full citation as it would appear in the brief, e.g. 'United States v. Weimert, 819 F.3d 351, 355 (7th Cir. 2016)'." },
        jurisdiction: { type: "string", description: "Optional jurisdiction hint (federal circuit, state) used for reporter/court matching." },
      },
      required: ["raw"],
    },
    handler: (input: unknown) => citeVerify(input as CiteVerifyInput),
  },

  cite_lookup: {
    name: "cite_lookup",
    description:
      "Search CourtListener for a case by name when the reporter/page are unknown. Returns ranked candidates the model can choose from in a follow-up turn. Prefer cite_verify when the citation is already complete.",
    input_schema: {
      type: "object",
      properties: {
        case_name: { type: "string", description: "Case name, e.g. 'United States v. Weimert'." },
        jurisdiction: { type: "string" },
        year: { type: "integer", description: "Optional year of decision; narrows candidates." },
      },
      required: ["case_name"],
    },
    handler: (input: unknown) => citeLookup(input as CiteLookupInput),
  },

  // posture_detect / ethics_check / plan_check run on the 9-LLM waterfall via
  // critic-llm.ts (small-model row: llama-3.1-8b on Groq/Cerebras, gemini-flash,
  // etc.). Free for admin/free-tier; cheap for everyone else. No Haiku spend.
  // draft_skeleton_load and retrieval_query remain scaffolded — wave B follow-on.
  posture_detect: {
    name: "posture_detect",
    description: "Classify the procedural posture of a matter from a short fact summary (pre-lit, pleadings, discovery, msj, trial, appeal). Runs on the waterfall small-model tier.",
    input_schema: {
      type: "object",
      properties: { matter_facts: { type: "string" } },
      required: ["matter_facts"],
    },
    handler: (input: unknown) => postureDetect(input as PostureDetectInput),
  },

  ethics_check: {
    name: "ethics_check",
    description: "Run the Ethics Circuit Model Rules walkthrough on an action description. Returns rules implicated, severity, and a permissible alternative. Runs on the waterfall small-model tier.",
    input_schema: {
      type: "object",
      properties: { action: { type: "string" }, jurisdiction: { type: "string" } },
      required: ["action", "jurisdiction"],
    },
    handler: (input: unknown) => ethicsCheck(input as EthicsCheckInput),
  },

  plan_check: {
    name: "plan_check",
    description: "Validate a Plan-then-Execute numbered plan: completeness, missing steps, token estimate. Runs on the waterfall small-model tier.",
    input_schema: {
      type: "object",
      properties: { plan: { type: "array", items: { type: "string" } } },
      required: ["plan"],
    },
    handler: (input: unknown) => planCheck(input as PlanCheckInput),
  },

  draft_skeleton_load: {
    name: "draft_skeleton_load",
    description: "Load a jurisdiction-specific draft skeleton (caption block, headings, certifications) for a recognized doc type. v6 wave B.",
    input_schema: {
      type: "object",
      properties: {
        doc_type: { type: "string", enum: ["complaint", "answer", "12b6", "msj", "msj_opp", "appeal_brief", "demand_letter", "memorandum"] },
        jurisdiction: { type: "string" },
        court: { type: "string" },
      },
      required: ["doc_type", "jurisdiction", "court"],
    },
    handler: async () => { throw new Error("draft_skeleton_load: pending v6 wave B"); },
  },

  retrieval_query: {
    name: "retrieval_query",
    description:
      "Retrieve relevant opinion spans from a hybrid CAP FAISS + CourtListener index. Available only on the Research page (existing constraint preserved). v6 wave B.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        filters: {
          type: "object",
          properties: {
            jurisdiction: { type: "string" },
            posture: { type: "string" },
            date_range: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2 },
            doc_type: { type: "string" },
          },
        },
      },
      required: ["query"],
    },
    handler: async () => { throw new Error("retrieval_query: pending v6 wave B"); },
  },
};

export function getTool(name: ToolName): ToolDefinition | undefined {
  return ARES_TOOLS[name];
}

export function listTools(): ToolDefinition[] {
  return Object.values(ARES_TOOLS);
}

// Anthropic tool-use definition format — strip the runtime handler, leaving
// only the wire-format object. Use this to populate `tools: [...]` on a
// /v1/messages call when v6 native tool-calling is wired in apps/api.
export interface AnthropicToolWire {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export function toolToAnthropicWire(t: ToolDefinition): AnthropicToolWire {
  return { name: t.name, description: t.description, input_schema: t.input_schema };
}

export async function dispatchTool<I = unknown, O = unknown>(name: ToolName, input: I): Promise<O> {
  const tool = ARES_TOOLS[name] as ToolDefinition<I, O> | undefined;
  if (!tool) throw new Error(`Unknown ARES tool: ${name}`);
  return tool.handler(input);
}

// Parse the v5 prose <<TOOL_REQUEST: name {json}>> syntax. Useful for both
// (a) executing requests opportunistically server-side, and (b) telemetry of
// what the model wanted before v6 native tool-calling is enabled.
const TOOL_REQUEST_RE = /<<TOOL_REQUEST:\s*([a-z_]+)\s*({[\s\S]*?})\s*>>/g;

export interface ParsedToolRequest {
  name: ToolName;
  args: Record<string, unknown>;
  raw: string;
}

export function parseToolRequests(text: string): ParsedToolRequest[] {
  const out: ParsedToolRequest[] = [];
  TOOL_REQUEST_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOOL_REQUEST_RE.exec(text)) !== null) {
    const name = m[1] as ToolName;
    if (!ARES_TOOLS[name]) continue;
    try {
      const args = JSON.parse(m[2]);
      if (args && typeof args === "object") {
        out.push({ name, args: args as Record<string, unknown>, raw: m[0] });
      }
    } catch {
      // Malformed JSON — skip silently; the model will see no tool result and adapt.
    }
  }
  return out;
}
