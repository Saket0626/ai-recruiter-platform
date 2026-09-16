export function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      shortCircuit: true,
      url: new URL("./empty-module.mjs", import.meta.url).href,
    };
  }
  return nextResolve(specifier, context);
}
