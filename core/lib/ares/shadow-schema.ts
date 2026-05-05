// ARES v5 / v6 — shadow JSON schema (ares.shadow.v1)
// Runtime guards. Plain TS, no dependency on Zod (kept light by design).
// The canonical schema definition lives here; extract.ts re-uses the type.
//
// Plan: ~/.claude/plans/jaunty-dazzling-horizon.md

export const ARES_SHADOW_SCHEMA = "ares.shadow.v1" as const;

export type AresMode = "LITE" | "STANDARD" | "DEEP";
export type AresPosture = "pre-lit" | "pleadings" | "discovery" | "msj" | "trial" | "appeal";
export type CiteType = "case" | "statute" | "reg" | "rule" | "secondary";
export type SubsequentHistory = "ok" | "distinguished" | "overruled" | "unknown";
export type VerifiedVia = "model" | "cite_verify" | "cite_lookup";
export type Outcome = "favorable" | "adverse" | "mixed" | "unsettled";

export interface AresShadowJurisdiction {
  court?: string;
  circuit?: string | null;
  state?: string | null;
}

export interface AresShadowIssue {
  id: string;
  question: string;
  controlling_standard?: string;
  source?: string;
}

export interface AresShadowHolding {
  issue: string;
  rule: string;
  outcome_for_client?: Outcome;
}

export interface AresShadowCite {
  raw: string;
  type?: CiteType;
  binding?: boolean;
  confidence?: number;
  verified_via?: VerifiedVia;
  subsequent_history?: SubsequentHistory;
}

export interface AresShadowSplit {
  topic: string;
  sides: Array<{ circuits: string[]; position: string }>;
}

export interface AresShadowCounter {
  oc_position: string;
  our_response: string;
  addressed?: boolean;
}

export interface AresShadowConfidence {
  overall?: number;
  citation_integrity?: number;
  counterargument_coverage?: number;
}

export interface AresShadowToolReq {
  name: string;
  args: Record<string, unknown>;
}

export interface AresShadowEthics {
  triggered: boolean;
  rule?: string | null;
  outcome?: string | null;
}

export interface AresShadow {
  schema: typeof ARES_SHADOW_SCHEMA;
  prompt_version?: string;
  mode?: AresMode;
  posture?: AresPosture;
  jurisdiction?: AresShadowJurisdiction;
  issues?: AresShadowIssue[];
  holdings?: AresShadowHolding[];
  cites?: AresShadowCite[];
  circuit_splits?: AresShadowSplit[];
  counterarguments?: AresShadowCounter[];
  flags?: string[];
  confidence?: AresShadowConfidence;
  bottom_line?: string;
  tool_requests?: AresShadowToolReq[];
  ethics_review?: AresShadowEthics;
}

export function isAresShadow(value: unknown): value is AresShadow {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.schema === ARES_SHADOW_SCHEMA;
}

// Minimum-required field validation for downstream consumers.
export function validateShadow(value: unknown): { ok: true; shadow: AresShadow } | { ok: false; error: string } {
  if (!isAresShadow(value)) return { ok: false, error: "missing or wrong schema field" };
  const v = value as AresShadow;
  if (v.cites && !Array.isArray(v.cites)) return { ok: false, error: "cites is not an array" };
  if (v.flags && !Array.isArray(v.flags)) return { ok: false, error: "flags is not an array" };
  return { ok: true, shadow: v };
}
