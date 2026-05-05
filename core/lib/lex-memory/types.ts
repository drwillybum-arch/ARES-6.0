export type TabId = "research" | "strategy" | "draft" | "judge" | "citations" | "deep-research" | "conflict" | "vault";

export type AuthorityKind = "case" | "statute" | "regulation" | "rule" | "constitutional";
export type CourtTier = "scotus" | "circuit" | "district" | "state-high" | "state-lower" | "unknown";
export type Confidence = 1 | 2 | 3; // 1=weak, 2=moderate, 3=strong

// ── Level 4: Theme (always injected, ~50 tokens) ──────────────────────────
export interface Level4Theme {
  matterType?: string;
  jurisdiction?: string;
  court?: string;
  judge?: string;
  parties: Array<{ role: string; name: string }>;
  primaryTheory?: string;
  posture?: string;       // "defense" | "plaintiff" | "petitioner" etc.
  statuteRefs: string[];  // e.g. ["18USC1343", "42USC1983"]
  updatedAt: number;
}

// ── Level 3: Semantic Nodes (ranked, budget-filled) ───────────────────────
export interface Level3Authority {
  kind: "authority";
  id: string;             // slug, e.g. "neder_v_us_527_us_1"
  citation: string;       // full Bluebook
  shortCite: string;      // e.g. "Neder, 527 U.S. 1"
  authorityKind: AuthorityKind;
  courtTier: CourtTier;
  proposition?: string;   // one-line holding relevant to this matter
  verified: boolean;      // confirmed by citations page
  confirmedBy: TabId[];
  lastRefAt: number;
  confidence: Confidence;
  score?: number;         // computed by rank.ts, not persisted
}

export interface Level3Strategy {
  kind: "strategy";
  id: string;
  label: string;          // e.g. "MTD_no_materiality"
  detail?: string;        // tactical detail
  confirmedBy: TabId[];
  lastRefAt: number;
  confidence: Confidence;
  score?: number;
}

export interface Level3OpenQuestion {
  kind: "open";
  id: string;
  question: string;       // e.g. "verify Weimert SDNY applicability"
  blocking: boolean;      // blocking=true → always injected if fits budget
  raisedBy: TabId;
  raisedAt: number;
  resolvedAt?: number;
  score?: number;
}

export type Level3Node = Level3Authority | Level3Strategy | Level3OpenQuestion;

// ── Level 2: Episodes (compressed summaries, 2 most recent injected) ──────
export interface Level2Episode {
  id: string;
  tab: TabId;
  date: string;           // ISO date string
  summary: string;        // caveman-compressed, ≤100 tokens
  derivedNodeIds: string[];
  createdAt: number;
}

// ── Level 1: Raw (never injected, audit trail only) ───────────────────────
export interface Level1Raw {
  id: string;
  tab: TabId;
  text: string;
  createdAt: number;
}

// ── Root memory object ────────────────────────────────────────────────────
export interface LexMemory {
  version: 1;
  theme: Level4Theme;
  nodes: Level3Node[];     // cap: 80
  episodes: Level2Episode[]; // cap: 3 per tab = 18 total
  raw: Level1Raw[];        // cap: 5 per tab = 30 total
  updatedAt: number;
}

// ── Delta returned by extract.ts ─────────────────────────────────────────
export interface LexMemoryDelta {
  themePatches?: Partial<Level4Theme>;
  nodes?: Level3Node[];
  episode?: Level2Episode;
  raw?: Level1Raw;
}
