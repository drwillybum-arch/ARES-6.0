export type TabId = "overview" | "strategy" | "research" | "draft" | "judge" | "conflict" | "timeline" | "vault" | "notes" | "billing" | "citations" | "deadlines" | "docket" | "dashboard" | "admin" | "administration" | "feedback" | "settings" | "changelog" | "clients";

export interface Matter {
  id: string;
  case_name?: string;
  court?: string;
  docket_number?: string;
  facts?: string;
  lexMemory?: any;
  metadata?: any;
  caseType?: string;
  jurisdiction?: string;
  judgeName?: string;
  client?: string;
  verifiedCitations?: string[];
}

export interface AnthropicFetchOptions {
  onChunk?: (text: string) => void;
  signal?: AbortSignal;
}
