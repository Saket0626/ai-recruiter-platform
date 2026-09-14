import { getEnv } from "@/lib/config/env";
import type { LLMProvider, LlmRequest } from "@/lib/llm/provider";

export class OpenAiCompatibleProvider implements LLMProvider {
  readonly name = "openai-compatible";

  async complete(request: LlmRequest): Promise<string> {
    const env = getEnv();
    if (!env.LLM_API_KEY) {
      throw new Error("LLM_API_KEY is not configured");
    }
    const response = await fetch(`${env.LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        temperature: request.temperature,
        messages: request.messages,
        ...(request.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`LLM HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM returned an empty response");
    return content;
  }
}
