import { COURTLISTENER_BASE, getApiHeaders } from "./api";

export interface CLOpinion {
  id: number;
  caseName: string;
  citation: string;
  court: string;
  dateFiled: string;
  snippet: string;
  absoluteUrl: string;
}

export interface CLPerson {
  id: number;
  nameFull: string;
  politicalAffiliation: string;
  abaRating: string;
  positions: CLPosition[];
}

export interface CLPosition {
  court: string;
  date_start: string;
  date_termination: string | null;
  position_type: string;
}

export interface CLLookupResult {
  input: string;
  verified: boolean;
  caseName?: string;
  reporter?: string;
  dateFiled?: string;
  absoluteUrl?: string;
}

export async function searchOpinions(q: string, limit = 5): Promise<CLOpinion[]> {
  const params = new URLSearchParams({ q, type: "o", page_size: String(limit) });
  const res = await fetch(`${COURTLISTENER_BASE}/search/?${params}`, {
    headers: getApiHeaders(),
  });
  if (!res.ok) throw new Error(`CourtListener search failed: ${res.status}`);
  const data = await res.json() as {
    results?: Array<{
      id: number;
      caseName?: string;
      citation?: string[];
      court?: string;
      dateFiled?: string;
      snippet?: string;
      absolute_url?: string;
    }>;
  };
  return (data.results ?? []).map(r => ({
    id: r.id,
    caseName: r.caseName ?? "Unknown",
    citation: r.citation?.[0] ?? "",
    court: r.court ?? "",
    dateFiled: r.dateFiled ?? "",
    snippet: r.snippet ?? "",
    absoluteUrl: r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : "",
  }));
}

export async function searchPeople(name: string): Promise<CLPerson[]> {
  const params = new URLSearchParams({ full_name: name });
  const res = await fetch(`${COURTLISTENER_BASE}/people/?${params}`, {
    headers: getApiHeaders(),
  });
  if (!res.ok) throw new Error(`CourtListener people failed: ${res.status}`);
  const data = await res.json() as {
    results?: Array<{
      id: number;
      name_full?: string;
      political_affiliation?: string;
      aba_rating?: string;
      positions?: CLPosition[];
    }>;
  };
  return (data.results ?? []).map(r => ({
    id: r.id,
    nameFull: r.name_full ?? "",
    politicalAffiliation: r.political_affiliation ?? "",
    abaRating: r.aba_rating ?? "",
    positions: r.positions ?? [],
  }));
}

export interface CLOpinionDetail {
  id: number;
  caseName: string;
  court: string;
  dateFiled: string;
  citations: string[];
  plainText: string;
  absoluteUrl: string;
}

export interface CLDocket {
  id: number;
  caseName: string;
  court: string;
  docketNumber: string;
  dateFiled: string;
  dateTerminated: string | null;
  assignedTo: string | null;
  absoluteUrl: string;
}

export async function getOpinion(id: number): Promise<CLOpinionDetail | null> {
  const res = await fetch(`${COURTLISTENER_BASE}/opinions/${id}/`, { headers: getApiHeaders() });
  if (!res.ok) return null;
  const d = await res.json() as {
    id?: number;
    case_name?: string;
    court?: string;
    date_filed?: string;
    citations?: Array<{ volume?: number; reporter?: string; page?: number }>;
    plain_text?: string;
    absolute_url?: string;
  };
  return {
    id: d.id ?? id,
    caseName: d.case_name ?? "Unknown",
    court: d.court ?? "",
    dateFiled: d.date_filed ?? "",
    citations: (d.citations ?? []).map(c => `${c.volume} ${c.reporter} ${c.page}`).filter(Boolean),
    plainText: (d.plain_text ?? "").slice(0, 5000),
    absoluteUrl: d.absolute_url ? `https://www.courtlistener.com${d.absolute_url}` : "",
  };
}

export async function getDocket(docketId: number): Promise<CLDocket | null> {
  const res = await fetch(`${COURTLISTENER_BASE}/dockets/${docketId}/`, { headers: getApiHeaders() });
  if (!res.ok) return null;
  const d = await res.json() as {
    id?: number;
    case_name?: string;
    court?: string;
    docket_number?: string;
    date_filed?: string;
    date_terminated?: string | null;
    assigned_to_str?: string | null;
    absolute_url?: string;
  };
  return {
    id: d.id ?? docketId,
    caseName: d.case_name ?? "Unknown",
    court: d.court ?? "",
    docketNumber: d.docket_number ?? "",
    dateFiled: d.date_filed ?? "",
    dateTerminated: d.date_terminated ?? null,
    assignedTo: d.assigned_to_str ?? null,
    absoluteUrl: d.absolute_url ? `https://www.courtlistener.com${d.absolute_url}` : "",
  };
}

export async function citationLookup(citations: string[]): Promise<CLLookupResult[]> {
  const body = new URLSearchParams();
  citations.forEach(c => body.append("citations[]", c));
  const res = await fetch(`${COURTLISTENER_BASE}/citation-lookup/`, {
    method: "POST",
    headers: { ...getApiHeaders(), "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Citation lookup failed: ${res.status}`);
  const data = await res.json() as Array<{
    normalized_citations?: Array<{
      case_name?: string;
      reporter?: string;
      date_filed?: string;
      absolute_url?: string;
    }>;
  }>;
  return citations.map((input, i) => {
    const match = data?.[i]?.normalized_citations?.[0];
    return {
      input,
      verified: !!match,
      caseName: match?.case_name,
      reporter: match?.reporter,
      dateFiled: match?.date_filed,
      absoluteUrl: match?.absolute_url
        ? `https://www.courtlistener.com${match.absolute_url}`
        : undefined,
    };
  });
}
