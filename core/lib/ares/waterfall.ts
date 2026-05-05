export interface Provider {
  name: string;
  key: string | undefined;
  url: string;
  model: (requestedModel: string) => string;
  extraHeaders?: Record<string, string>;
}

export const PROVIDERS: Provider[] = [
  {
    name: "mistral",
    key: process.env.MISTRAL_API_KEY,
    url: "https://api.mistral.ai/v1/chat/completions",
    model: (m) => m.includes("haiku") ? "mistral-small-latest" : "mistral-large-latest",
  },
  {
    name: "groq",
    key: process.env.GROQ_API_KEY,
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: (m) => m.includes("haiku") ? "llama-3.3-70b-versatile" : "llama-3.3-70b-versatile",
  },
  {
    name: "cerebras",
    key: process.env.CEREBRAS_API_KEY,
    url: "https://api.cerebras.ai/v1/chat/completions",
    model: (m) => m.includes("haiku") ? "llama3.3-70b" : "llama3.3-70b",
  },
  {
    name: "sambanova",
    key: process.env.SAMBANOVA_API_KEY,
    url: "https://api.sambanova.ai/v1/chat/completions",
    model: () => "Meta-Llama-3.3-70B-Instruct",
  },
  {
    name: "openrouter",
    key: process.env.OPENROUTER_API_KEY,
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: () => "meta-llama/llama-3.3-70b-instruct",
    extraHeaders: {
      "HTTP-Referer": "https://lexagent.app",
      "X-Title": "LexAgent",
    },
  },
  {
    name: "nvidia",
    key: process.env.NVIDIA_API_KEY,
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    model: () => "meta/llama-3.3-70b-instruct",
  },
  {
    name: "xai",
    key: process.env.XAI_API_KEY,
    url: "https://api.x.ai/v1/chat/completions",
    model: () => "grok-2-latest",
  },
  {
    name: "gemini",
    key: process.env.GEMINI_API_KEY,
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: () => "gemini-2.0-flash",
  },
];

export interface ProviderResult {
  text: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
}

export async function tryProviders(
  body: {
    messages: Array<{ role: string; content: string }>;
    system?: string;
    max_tokens: number;
    model: string;
  },
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const oaiMessages: Array<{ role: string; content: string }> = [];
  if (body.system) oaiMessages.push({ role: "system", content: body.system });
  oaiMessages.push(...body.messages);

  const errors: string[] = [];

  for (const provider of PROVIDERS) {
    if (!provider.key) continue;

    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.key}`,
          ...provider.extraHeaders,
          ...extraHeaders,
        },
        body: JSON.stringify({
          model: provider.model(body.model),
          max_tokens: body.max_tokens,
          messages: oaiMessages,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        errors.push(`${provider.name}: ${res.status} — ${errText.slice(0, 200)}`);
        continue;
      }

      const data = await res.json() as any;
      const text = data.choices?.[0]?.message?.content ?? "";
      if (!text.trim()) continue;

      // Wrap successful result in a synthetic Anthropic-like Response
      const anthropicResponse = {
        id: `msg_${Date.now()}`,
        type: "message",
        role: "assistant",
        model: body.model,
        content: [{ type: "text", text }],
        usage: {
          input_tokens: data.usage?.prompt_tokens ?? 0,
          output_tokens: data.usage?.completion_tokens ?? 0,
        },
      };

      return new Response(JSON.stringify(anthropicResponse), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Provider": provider.name,
          "X-Tier": "free-waterfall",
        },
      });
    } catch (err) {
      errors.push(`${provider.name}: ${err}`);
    }
  }

  return new Response(JSON.stringify({ error: `All providers exhausted:\n${errors.join("\n")}` }), {
    status: 502,
    headers: { "Content-Type": "application/json" },
  });
}
