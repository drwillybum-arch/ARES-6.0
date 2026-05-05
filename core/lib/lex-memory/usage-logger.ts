import { TabId } from "../ares/types";

export interface AiUsageEntry {
  matterId: string;
  tab: TabId;
  inputTok: number;
  outputTok: number;
  memInjected: number;
  model: string;
  promptVersion: string;
  mode: string | null;
  toolCalls?: any[] | null;
  criticScore?: number | null;
}

export async function logAiUsage(entry: AiUsageEntry): Promise<void> {
  // In standalone mode, we just log to console or local file.
  console.log("[ARES-USAGE]", JSON.stringify(entry));
}
