// Baileys uses pino-style loggers. This silences the verbose debug noise —
// only warnings + errors surface in the gateway logs.
const LEVEL = process.env.LOG_LEVEL || "silent"; // silent | fatal | error | warn | info | debug | trace

export const logger = {
  level: LEVEL,
  child: () => logger,
  fatal: (...args) => LEVEL !== "silent" && console.error("[FATAL]", ...args),
  error: (...args) => (LEVEL === "error" || LEVEL === "warn" || LEVEL === "info" || LEVEL === "debug") && console.error("[ERROR]", ...args),
  warn: (...args) => (LEVEL === "warn" || LEVEL === "info" || LEVEL === "debug") && console.warn("[WARN]", ...args),
  info: (...args) => (LEVEL === "info" || LEVEL === "debug") && console.log("[INFO]", ...args),
  debug: (...args) => LEVEL === "debug" && console.log("[DEBUG]", ...args),
  trace: (...args) => LEVEL === "trace" && console.log("[TRACE]", ...args),
};
