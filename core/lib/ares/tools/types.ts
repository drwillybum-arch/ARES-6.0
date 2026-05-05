// ARES v6 — tool registry types.
// Each tool has a Tool interface (machine-facing schema) and a runtime
// handler (input → output). Schemas are designed to map 1:1 onto Anthropic
// tool-use definitions when v6 wires native tool calling.
//
// Plan: ~/.claude/plans/jaunty-dazzling-horizon.md

import type { CiteType, SubsequentHistory } from "../shadow-schema";

export type ToolName =
  | "cite_verify"
  | "cite_lookup"
  | "posture_detect"
  | "ethics_check"
  | "plan_check"
  | "draft_skeleton_load"
  | "retrieval_query";

export interface ToolDefinition<I = unknown, O = unknown> {
  name: ToolName;
  description: string;
  input_schema: Record<string, unknown>;       // JSON-Schema, mirrors Anthropic tool-use shape
  handler: (input: I) => Promise<O>;
}

// ── cite_verify ───────────────────────────────────────────────────────────
export interface CiteVerifyInput {
  raw: string;
  jurisdiction?: string;
  // Optional surrounding prose from the drafter's document (≤ 2k chars).
  // Enables subsequent-history detection from local context (1.6.3 — eyecite
  // JS port substitute). If omitted, only CL cited-by is consulted.
  context?: string;
}

export interface CiteVerifyOutput {
  ok: boolean;
  normalized: string;
  type: CiteType;
  reporter_match: boolean;
  year_plausible: boolean;
  subsequent_history: SubsequentHistory;
  confidence: number;
  source_url?: string;
}

// ── cite_lookup ───────────────────────────────────────────────────────────
export interface CiteLookupInput {
  case_name: string;
  jurisdiction?: string;
  year?: number;
}

export interface CiteLookupCandidate {
  cite: string;
  case_name: string;
  court: string;
  year?: number;
  opinion_id?: number;
  source_url?: string;
}

export interface CiteLookupOutput {
  candidates: CiteLookupCandidate[];
}

// ── posture_detect ────────────────────────────────────────────────────────
export interface PostureDetectInput {
  matter_facts: string;
}

export interface PostureDetectOutput {
  posture: "pre-lit" | "pleadings" | "discovery" | "msj" | "trial" | "appeal";
  confidence: number;
  deadlines_implied: string[];
}

// ── ethics_check ──────────────────────────────────────────────────────────
export interface EthicsCheckInput {
  action: string;
  jurisdiction: string;
}

export interface EthicsCheckOutput {
  rules_implicated: string[];
  severity: "ok" | "modify" | "decline";
  permissible_alternative: string;
}

// ── plan_check ────────────────────────────────────────────────────────────
export interface PlanCheckInput {
  plan: string[];
}

export interface PlanCheckOutput {
  complete: boolean;
  missing_steps: string[];
  estimated_tokens: number;
}

// ── draft_skeleton_load ───────────────────────────────────────────────────
export interface DraftSkeletonInput {
  doc_type: "complaint" | "answer" | "12b6" | "msj" | "msj_opp" | "appeal_brief" | "demand_letter" | "memorandum";
  jurisdiction: string;
  court: string;
}

export interface DraftSkeletonOutput {
  skeleton: string;
  local_rules: string[];
}

// ── retrieval_query ───────────────────────────────────────────────────────
export interface RetrievalQueryInput {
  query: string;
  filters?: {
    jurisdiction?: string;
    posture?: string;
    date_range?: [string, string];
    doc_type?: string;
  };
}

export interface RetrievalSpan {
  text: string;
  cite: string;
  score: number;
  source_url?: string;
}

export interface RetrievalQueryOutput {
  spans: RetrievalSpan[];
}
