// ARES v6 — public barrel.
// Stable entry point for the rest of the app to import from. Anything not
// re-exported here is considered internal and may move during v6 wave B.
//
// Plan: ~/.claude/plans/jaunty-dazzling-horizon.md

export {
  ARES_SHADOW_SCHEMA,
  isAresShadow,
  validateShadow,
} from "./shadow-schema";

export type {
  AresShadow,
  AresShadowCite,
  AresShadowHolding,
  AresShadowIssue,
  AresShadowSplit,
  AresShadowCounter,
  AresShadowConfidence,
  AresShadowToolReq,
  AresShadowEthics,
  AresShadowJurisdiction,
  AresMode,
  AresPosture,
  CiteType,
  SubsequentHistory,
  VerifiedVia,
  Outcome,
} from "./shadow-schema";

export {
  ARES_TOOLS,
  getTool,
  listTools,
  toolToAnthropicWire,
  dispatchTool,
  parseToolRequests,
} from "./tools/registry";

export type { ParsedToolRequest, AnthropicToolWire } from "./tools/registry";

export type {
  ToolName,
  ToolDefinition,
  CiteVerifyInput,
  CiteVerifyOutput,
  CiteLookupInput,
  CiteLookupOutput,
  CiteLookupCandidate,
  PostureDetectInput,
  PostureDetectOutput,
  EthicsCheckInput,
  EthicsCheckOutput,
  PlanCheckInput,
  PlanCheckOutput,
  DraftSkeletonInput,
  DraftSkeletonOutput,
  RetrievalQueryInput,
  RetrievalQueryOutput,
  RetrievalSpan,
} from "./tools/types";

export { citeVerify, parseCite } from "./tools/cite-verify";
export { detectSubsequentHistory } from "./tools/subsequent-history";
export type { HistoryInput, HistoryResult } from "./tools/subsequent-history";
export { citeLookup } from "./tools/cite-lookup";
export { postureDetect } from "./tools/posture-detect";
export { ethicsCheck } from "./tools/ethics-check";
export { planCheck } from "./tools/plan-check";
export { critic, criticJson, ARES_CRITIC_MODEL } from "./critic-llm";
export { aresCritic, PROHIBITED_PATTERNS } from "./critic";
export type { CriticInput, CriticOutput, CriticScore } from "./critic";
export { aresDebate } from "./debate";
export type { DebateInput, DebateOutput, DebateRound, DebateRole, DebateOutcome } from "./debate";
