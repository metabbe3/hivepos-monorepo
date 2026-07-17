/**
 * Best-effort email transport. No-op if SMTP env vars are absent.
 *
 * Set these to enable:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * ponytail: no queue, no retry. sendEmail swallows errors and logs via pino.
 * Add BullMQ/Redis when daily volume exceeds ~100.
 */
import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "@/modules/shared/logging/logger";

let transport: Transporter | null = null;
let configured = false;

function getConfig() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  if (!host || !user || !pass || !from) return null;
  return { host, port, user, pass, from };
}

function getTransport(): Transporter | null {
  if (configured) return transport;
  configured = true;
  const cfg = getConfig();
  if (!cfg) {
    logger.warn("SMTP env vars not set — email notifications disabled");
    return null;
  }
  transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  logger.info({ host: cfg.host }, "SMTP transport configured");
  return transport;
}

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const t = getTransport();
  if (!t) return false;
  const from = process.env.SMTP_FROM!;
  try {
    await t.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return true;
  } catch (err) {
    // ponytail: swallow — ticket save must never fail on email.
    logger.error({ err, to: payload.to, subject: payload.subject }, "email send failed");
    return false;
  }
}
