import { LexMemory, Level3Authority, Level4Theme } from "./types";
import { Matter } from "../ares/types";

function inferCourtTier(court?: string): Level3Authority["courtTier"] {
  if (!court) return "unknown";
  const c = court.toLowerCase();
  if (c.includes("supreme") && c.includes("u.s")) return "scotus";
  if (c.includes("circuit") || c.includes("court of appeals")) return "circuit";
  if (c.includes("district")) return "district";
  if (c.includes("supreme")) return "state-high";
  return "unknown";
}

export function bootstrapMemory(matter: Matter): LexMemory {
  const now = Date.now();

  const theme: Level4Theme = {
    matterType: matter.caseType || undefined,
    jurisdiction: matter.jurisdiction || undefined,
    court: matter.court || undefined,
    judge: matter.judgeName || undefined,
    parties: matter.client ? [{ role: "client", name: matter.client }] : [],
    primaryTheory: undefined,
    posture: undefined,
    statuteRefs: [],
    updatedAt: now,
  };

  // Seed L3 nodes from verifiedCitations already on the matter
  const verifiedCitations = (matter.verifiedCitations as string[] | undefined) ?? [];
  const authorityNodes: Level3Authority[] = verifiedCitations.map((citation, i) => {
    const shortCite = citation.split(",")[0]?.trim() ?? citation.substring(0, 40);
    return {
      kind: "authority" as const,
      id: `bootstrap_auth_${i}_${shortCite.replace(/\s+/g, "_").toLowerCase().substring(0, 30)}`,
      citation,
      shortCite,
      authorityKind: "case",
      courtTier: inferCourtTier(matter.court),
      proposition: undefined,
      verified: true,
      confirmedBy: ["citations"],
      lastRefAt: now,
      confidence: 3,
    };
  });

  return {
    version: 1,
    theme,
    nodes: authorityNodes,
    episodes: [],
    raw: [],
    updatedAt: now,
  };
}
