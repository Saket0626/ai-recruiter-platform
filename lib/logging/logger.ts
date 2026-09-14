const SECRET_KEY = /(token|secret|password|authorization|api[_-]?key|contentbytes|resume)/i;

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > 4000) return `${value.slice(0, 4000)}…[truncated]`;
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SECRET_KEY.test(key) ? "[redacted]" : redact(nested);
    }
    return output;
  }
  return value;
}

type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...((redact(fields) as Record<string, unknown>) ?? {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};
