import { supabase } from "./supabase";

function toRow(userId: string, matter: Record<string, unknown>) {
  const {
    id, title, client, caseType, jurisdiction, status,
    facts, judgeName, court, shared, visibility, createdAt,
    ...rest
  } = matter;

  const vis = (visibility as string) || (shared ? "team" : "private");

  return {
    id,
    user_id: userId,
    title: (title as string) || "Untitled Matter",
    client: (client as string) || null,
    matter_type: (caseType as string) || null,
    jurisdiction: (jurisdiction as string) || null,
    status: (status as string) || "active",
    facts: (facts as string) || null,
    judge_name: (judgeName as string) || null,
    court: (court as string) || null,
    shared: vis !== "private",
    visibility: vis,
    metadata: { ...rest, createdAt },
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: Record<string, unknown>) {
  const {
    id, title, client, matter_type, jurisdiction, status,
    facts, judge_name, court, shared, visibility, metadata, created_at,
  } = row;
  const meta = (metadata as Record<string, unknown>) || {};
  const vis = (visibility as string) || (shared ? "team" : "private");
  return {
    ...meta,
    id,
    title,
    client: (client as string) || "",
    caseType: (matter_type as string) || "",
    jurisdiction: (jurisdiction as string) || "",
    status: (status as string) || "active",
    facts: (facts as string) || "",
    judgeName: (judge_name as string) || "",
    court: (court as string) || "",
    shared: vis !== "private",
    visibility: vis,
    createdAt: (meta.createdAt as number) || new Date(created_at as string).getTime(),
    precedents: (meta.precedents as unknown[]) || [],
    notes: (meta.notes as unknown[]) || [],
    allVerifications: (meta.allVerifications as unknown[]) || [],
    deadlines: (meta.deadlines as unknown[]) || [],
    timeEntries: (meta.timeEntries as unknown[]) || [],
    totalMinsBilled: (meta.totalMinsBilled as number) || 0,
  };
}

export async function loadMatters(userId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("matters")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function upsertMatter(userId: string, matter: Record<string, unknown>): Promise<void> {
  const row = toRow(userId, matter);
  const { error } = await supabase
    .from("matters")
    .upsert(row, { onConflict: "id" });
  if (error) throw error;
}

export async function upsertMatters(userId: string, matters: Record<string, unknown>[]): Promise<void> {
  if (!matters.length) return;
  const rows = matters.map((m) => toRow(userId, m));
  const { error } = await supabase
    .from("matters")
    .upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

export async function loadSharedMatters(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("matters")
    .select("*")
    .eq("shared", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

// Loads matters the current user can access but does not own (team/custom shared)
export async function loadTeamMatters(userId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("matters")
    .select("*")
    .neq("user_id", userId)
    .in("visibility", ["team", "custom"])
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data || []).map((row) => ({ ...fromRow(row), _shared: true }));
}

export async function deleteMatter(matterId: string): Promise<void> {
  const { error } = await supabase
    .from("matters")
    .delete()
    .eq("id", matterId);
  if (error) throw error;
}
