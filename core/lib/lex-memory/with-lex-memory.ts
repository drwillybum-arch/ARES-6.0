import { Matter, AnthropicFetchOptions, TabId } from "../ares/types";
import { tryProviders as anthropicFetch } from "../ares/waterfall";
import { ARES_PROMPT_VERSION } from "../settings";
import { LexMemory } from "./types";
import { bootstrapMemory } from "./bootstrap";
import { buildContext } from "./build-context";
import { extractDelta, parseAresShadow } from "./extract";
import { mergeMemory } from "./merge";
import { BUDGET_DEFAULT } from "./tokens";
import { logAiUsage } from "./usage-logger";
import { aresCritic } from "../ares";
import { parseToolRequests, dispatchTool } from "../ares/tools/registry";
import type { CiteVerifyOutput } from "../ares/tools/types";

export interface LexMemoryOpts {
  tab: TabId;
  budget?: number;
}

export type UpdateMatterFn = (updated: Matter | ((prev: Matter) => Matter)) => Promise<void>;

function getOrBootstrap(matter: Matter): LexMemory {
  const stored = matter.lexMemory as LexMemory | undefined;
  if (stored?.version === 1) return stored;
  return bootstrapMemory(matter);
}

function extractText(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  const content = j["content"];
  if (Array.isArray(content) && content[0] && typeof (content[0] as Record<string, unknown>)["text"] === "string") {
    return (content[0] as { text: string }).text;
  }
  return null;
}

function extractUsage(json: unknown): { input_tokens: number; output_tokens: number } | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  const usage = j["usage"] as Record<string, unknown> | undefined;
  if (usage && typeof usage["input_tokens"] === "number" && typeof usage["output_tokens"] === "number") {
    return { input_tokens: usage["input_tokens"] as number, output_tokens: usage["output_tokens"] as number };
  }
  if (usage && typeof usage["prompt_tokens"] === "number") {
    return {
      input_tokens: usage["prompt_tokens"] as number,
      output_tokens: (usage["completion_tokens"] as number) ?? 0,
    };
  }
  return null;
}

export function withLexMemory(
  matter: Matter,
  updateMatter: UpdateMatterFn,
  opts: LexMemoryOpts
) {
  return async function lexFetch(
    body: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
    options?: AnthropicFetchOptions
  ): Promise<Response> {
    const mem = getOrBootstrap(matter);
    const { text: ctxBlock, tokensUsed: memInjected } = buildContext(mem, {
      budget: opts.budget ?? BUDGET_DEFAULT,
      currentTab: opts.tab,
    });

    const baseBody = ctxBlock
      ? { ...body, system: `${ctxBlock}\n\n${body["system"] ?? ""}`.trim() }
      : { ...body };

    // Phase 12 Slice A — usage attribution. Backend reads these to write
    // usage_events.matter_id and usage_events.tool_name.
    const patchedBody = { ...baseBody, matter_id: matter.id, tool_name: opts.tab };

    const res = await anthropicFetch(patchedBody, extraHeaders, options);

    const clone = res.clone();
    void (async () => {
      try {
        if (!clone.ok) return;
        const json = await clone.json() as unknown;
        const text = extractText(json);
        const shadow = text ? parseAresShadow(text) : null;
        if (text) {
          const delta = extractDelta(text, opts.tab);
          // Functional update: re-reads fresh matter from state, avoids clobbering
          // concurrent writes made between call-time and extraction completion.
          await updateMatter((prev) => {
            if (prev.id !== matter.id) return prev;
            const currentMem = getOrBootstrap(prev);
            const merged = mergeMemory(currentMem, delta);
            return { ...prev, lexMemory: merged };
          });
        }
        const usage = extractUsage(json);
        let criticScore: number | null = null;
        if (text) {
          const criticOut = await aresCritic({
            draft: text,
            shadow,
            mode: shadow?.mode ?? null,
            posture: shadow?.posture ?? null,
            matterId: matter.id,
          }).catch(() => null);
          criticScore = criticOut?.persisted_score ?? null;
        }

        // Execute cite_verify tool requests from ARES response.
        // Passes matter.facts as context for local subsequent-history detection.
        if (text) {
          const toolReqs = parseToolRequests(text).filter((r) => r.name === "cite_verify");
          if (toolReqs.length > 0) {
            const factsContext = matter.facts ? matter.facts.substring(0, 2000) : undefined;
            const results = await Promise.allSettled(
              toolReqs.map((r) =>
                dispatchTool<Record<string, unknown>, CiteVerifyOutput>("cite_verify", {
                  ...r.args,
                  context: factsContext,
                })
              )
            );
            const citeResults = results
              .map((r, i) => ({
                raw: toolReqs[i].args["raw"] as string,
                ...(r.status === "fulfilled" ? r.value : { ok: false, confidence: 0, subsequent_history: "unknown" as const }),
              }));
            await updateMatter((prev) => {
              if (prev.id !== matter.id) return prev;
              const meta = (prev.metadata ?? {}) as Record<string, unknown>;
              const existing = (meta["cite_results"] as typeof citeResults | undefined) ?? [];
              return {
                ...prev,
                metadata: { ...meta, cite_results: [...citeResults, ...existing].slice(0, 50) },
              };
            }).catch(() => {});
          }
        }

        await logAiUsage({
          matterId: matter.id,
          tab: opts.tab,
          inputTok: usage?.input_tokens ?? 0,
          outputTok: usage?.output_tokens ?? 0,
          memInjected,
          model: (body["model"] as string) ?? "unknown",
          promptVersion: shadow?.prompt_version?.replace(/^ARES-/, "") ?? ARES_PROMPT_VERSION,
          mode: shadow?.mode ?? null,
          toolCalls: shadow?.tool_requests ?? null,
          criticScore,
        }).catch(() => {});
      } catch (e) {
        console.warn("[lex-memory] extraction failed:", (e as Error).message);
      }
    })();

    return res;
  };
}
