export function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return message.replace(/Bearer\s+\S+/gi, "[redacted]").replace(/sk-[A-Za-z0-9]+/g, "[redacted]");
}
