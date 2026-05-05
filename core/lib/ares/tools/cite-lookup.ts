// ARES v6 — cite_lookup tool.
// Search CourtListener by case name when the model has the name but is
// uncertain about reporter/page. Returns ranked candidates the model can
// pick from in a follow-up turn.
//
// Plan: ~/.claude/plans/jaunty-dazzling-horizon.md

import { searchOpinions } from "../../courtlistener";
import type { CiteLookupInput, CiteLookupOutput, CiteLookupCandidate } from "./types";

export async function citeLookup(input: CiteLookupInput): Promise<CiteLookupOutput> {
  const q = input.year
    ? `${input.case_name} ${input.year}`
    : input.case_name;

  const opinions = await searchOpinions(q, 8).catch(() => []);

  const candidates: CiteLookupCandidate[] = opinions
    .filter(o => o.caseName !== "Unknown" && o.citation)
    .map(o => ({
      cite: o.citation,
      case_name: o.caseName,
      court: o.court,
      year: o.dateFiled ? parseInt(o.dateFiled.substring(0, 4), 10) : undefined,
      opinion_id: o.id,
      source_url: o.absoluteUrl || undefined,
    }))
    .filter(c => !input.year || c.year === input.year || Math.abs((c.year ?? 0) - input.year) <= 1);

  return { candidates };
}
