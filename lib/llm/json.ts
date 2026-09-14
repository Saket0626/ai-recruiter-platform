import { type ZodType } from "zod";

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

export function parseStructured<T>(schema: ZodType<T>, text: string): T {
  const parsed = extractJson(text);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Malformed structured output: ${result.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  return result.data;
}
