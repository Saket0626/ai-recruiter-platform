const BIND_HOSTS = new Set(["0.0.0.0", "::", "[::]"]);

function hostnameOf(host: string) {
  return host.split(",")[0]?.trim().split(":")[0]?.replace(/^\[|\]$/g, "") ?? "";
}

export function isPublicHost(host: string) {
  const hostname = hostnameOf(host);
  if (!hostname) return false;
  return !BIND_HOSTS.has(hostname);
}

export function publicOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost && isPublicHost(forwardedHost)) {
    const hostname = hostnameOf(forwardedHost);
    const proto =
      hostname === "localhost" || hostname === "127.0.0.1"
        ? forwardedProto || "http"
        : forwardedProto || "https";
    return `${proto}://${forwardedHost}`;
  }

  const url = new URL(request.url);
  if (isPublicHost(url.host)) return url.origin;

  const configured = process.env.GOOGLE_REDIRECT_URI;
  if (configured) {
    try {
      const origin = new URL(configured).origin;
      if (isPublicHost(new URL(origin).host)) return origin;
    } catch {
      // Ignore a malformed redirect URI and keep falling back.
    }
  }

  const host = request.headers.get("host");
  if (host && isPublicHost(host)) {
    return `${forwardedProto || url.protocol.replace(":", "") || "https"}://${host}`;
  }

  return url.origin;
}
