export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmRequest = {
  messages: LlmMessage[];
  temperature: number;
  json?: boolean;
};

export interface LLMProvider {
  readonly name: string;
  complete(request: LlmRequest): Promise<string>;
}
