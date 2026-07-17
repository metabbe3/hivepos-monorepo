import pino, { type Logger, type LoggerOptions } from "pino";

const isDev = process.env.NODE_ENV !== "production";

const baseConfig: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  base: {
    service: "pos-saas",
    env: process.env.NODE_ENV ?? "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

/**
 * Development: pretty-printed, human-readable logs for fast triage.
 * Production: newline-delimited JSON for log aggregation (Datadog, Loki, …).
 */
const logger: Logger = isDev
  ? pino({
      ...baseConfig,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      },
    })
  : pino(baseConfig);

export { logger };
export type { Logger } from "pino";

/**
 * Create a child logger scoped to a request/handler.
 *
 *   const log = logger.child({ requestId, tenantId, branchId, userId });
 *   log.info("creating order", { customerId });
 */
export function requestLogger(context: {
  requestId?: string;
  tenantId?: string;
  branchId?: string;
  userId?: string;
  [key: string]: unknown;
}): Logger {
  return logger.child(context);
}
