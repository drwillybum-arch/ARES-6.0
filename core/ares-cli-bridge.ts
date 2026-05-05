import * as dotenv from "dotenv";
import * as path from "path";

// Load ARES-specific environment variables
dotenv.config({ path: path.join(__dirname, ".env") });

import { aresCritic } from "./lib/ares/critic";
import { tryProviders } from "./lib/ares/waterfall";
import { bootstrapMemory } from "./lib/lex-memory/bootstrap";
import { buildContext } from "./lib/lex-memory/build-context";
import { extractDelta, parseAresShadow } from "./lib/lex-memory/extract";
import { mergeMemory } from "./lib/lex-memory/merge";
import { aresDebate } from "./lib/ares/debate";
import { dispatchTool, listTools } from "./lib/ares/tools/registry";
import { Matter } from "./lib/ares/types";

async function main() {
  let data = "";
  process.stdin.on("data", chunk => {
    data += chunk;
  });

  process.stdin.on("end", async () => {
    try {
      const input = JSON.parse(data);
      const { action, payload } = input;

      if (action === "list_tools") {
        const tools = listTools().map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
        console.log(JSON.stringify(tools));
      }
      else if (action === "dispatch_tool") {
        const { name, args } = payload;
        const result = await dispatchTool(name, args);
        console.log(JSON.stringify(result));
      }
      else if (action === "critic") {
        const output = await aresCritic(payload);
        console.log(JSON.stringify(output));
      } 
      else if (action === "debate") {
        const output = await aresDebate(payload);
        console.log(JSON.stringify(output));
      }
      else if (action === "generate") {
        const { messages, system, model, matter, tab, use_debate } = payload;
        
        // 1. Build Memory Context
        const m: Matter = matter || { id: "default-matter" };
        if (!m.lexMemory) m.lexMemory = bootstrapMemory(m);
        
        const { text: ctxBlock } = buildContext(m.lexMemory, {
          budget: 4000,
          currentTab: tab || "research"
        });

        let finalSystem = `${ctxBlock}\n\n${system || ""}`.trim();

        // 2. Optional Debate Phase
        let debateResult = null;
        if (use_debate && (payload.posture === "msj" || payload.posture === "appeal")) {
           debateResult = await aresDebate({
             question: messages[messages.length - 1].content,
             facts: matter?.facts || "No facts provided.",
             posture: payload.posture,
             matterId: m.id
           });
           
           if (!debateResult.skipped) {
             finalSystem += `\n\nDEBATE INSIGHTS:\n${debateResult.reasoning}\nOutcome Prediction: ${debateResult.predicted_outcome} (${debateResult.confidence * 100}% confidence)`;
           }
        }

        // 3. Generate via Waterfall
        const res = await tryProviders({
          messages,
          system: finalSystem,
          max_tokens: payload.max_tokens || 2000,
          model: model || "claude-haiku-4-5-20251001"
        });
        
        const json = await res.json() as any;
        if (json.error) throw new Error(json.error);
        
        const text = json.content?.[0]?.text || "";
        const provider = res.headers.get("X-Provider") || "unknown";

        // 4. Extract Memory Delta & Shadows
        const shadow = parseAresShadow(text);
        const delta = extractDelta(text, tab || "research");
        const updatedMemory = mergeMemory(m.lexMemory, delta);

        console.log(JSON.stringify({
          text,
          provider,
          shadow,
          updatedMemory,
          delta,
          debate: debateResult
        }));
      }
      else {
        throw new Error(`Unknown action: ${action}`);
      }
    } catch (err: any) {
      console.error(JSON.stringify({ error: err.message }));
      process.exit(1);
    }
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
