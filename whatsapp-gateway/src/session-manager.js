import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import pino from "pino";
import { mkdir, readdir, rm } from "fs/promises";
import { join } from "path";

const baileysLogger = pino({ level: "warn" }); // warn so we see connection issues

const AUTH_STATES_DIR = join(process.cwd(), "auth-states");

/**
 * SessionManager — maintains one Baileys WASocket per tenant.
 *
 * Lifecycle:
 *   connect(tenantId) → create socket → QR or authenticated → save auth state
 *   disconnect(tenantId) → logout + delete auth state folder
 *   On startup → scan auth-states/ → auto-reconnect all saved sessions
 *
 * QR handling: Baileys emits a new QR every ~20s if not scanned. We cache the
 * latest QR (base64 PNG) so the FE can poll /:tenantId/qr and always get a fresh one.
 */
class SessionManager {
  constructor() {
    /** @type {Map<string, { sock: any, qr: string|null, status: string, phoneNumber: string|null }>} */
    this.sessions = new Map();
  }

  /**
   * Start (or restart) a session for a tenant.
   * @param {string} tenantId
   */
  async connect(tenantId) {
    // Already connected? Return status.
    const existing = this.sessions.get(tenantId);
    if (existing && existing.status === "connected") {
      return { status: "connected", phoneNumber: existing.phoneNumber };
    }

    const authDir = join(AUTH_STATES_DIR, tenantId);
    await mkdir(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const entry = {
      sock: null,
      qr: null,
      status: "connecting",
      phoneNumber: null,
      reconnectAttempts: 0,
    };

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: baileysLogger,
      browser: ["hivePOS", "Chrome", "1.0.0"],
      connectTimeoutMs: 20000,
    });

    entry.sock = sock;
    this.sessions.set(tenantId, entry);

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`[WhatsApp] Tenant ${tenantId} QR generated`);
        QRCode.toDataURL(qr, { width: 300 })
          .then((dataUrl) => {
            entry.qr = dataUrl;
            entry.status = "qr_ready";
          })
          .catch(() => {});
      }

      if (connection === "open") {
        entry.status = "connected";
        entry.qr = null;
        entry.phoneNumber = sock.user?.id?.split(":")[0] ?? null;
        console.log(`[WhatsApp] Tenant ${tenantId} connected as ${entry.phoneNumber}`);
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output?.statusCode
          : lastDisconnect?.error?.output?.statusCode;

        // Only reconnect on transient errors (5xx). Don't reconnect on:
        // - 408: QR timeout (nobody scanned the QR) — stop wasting resources
        // - 410: logged out (device revoked the session)
        // - 401/403: auth failure
        const transientErrors = [500, 502, 503, 504, 440, 442];
        const shouldReconnect = transientErrors.includes(statusCode);

        entry.status = shouldReconnect ? "reconnecting" : "disconnected";
        entry.qr = null;
        entry.phoneNumber = null;

        console.log(`[WhatsApp] Tenant ${tenantId} closed. statusCode=${statusCode} shouldReconnect=${shouldReconnect} error=${lastDisconnect?.error?.message ?? "none"}`);

        if (shouldReconnect) {
          entry.reconnectAttempts = (entry.reconnectAttempts ?? 0) + 1;
          if (entry.reconnectAttempts > 5) {
            console.log(`[WhatsApp] Tenant ${tenantId} max reconnect attempts (5) — giving up. POST /:tenantId/connect to retry.`);
            this.sessions.delete(tenantId);
            return;
          }
          const delay = Math.min(30000, 2000 * Math.pow(2, entry.reconnectAttempts - 1));
          console.log(`[WhatsApp] Tenant ${tenantId} reconnect attempt ${entry.reconnectAttempts} in ${delay}ms`);
          setTimeout(() => this.connect(tenantId), delay);
        } else {
          console.log(`[WhatsApp] Tenant ${tenantId} disconnected (statusCode=${statusCode}). Awaiting explicit POST /:tenantId/connect.`);
          // Don't delete auth state on QR timeout — creds might still be valid for next attempt.
          this.sessions.delete(tenantId);
          if (statusCode === DisconnectReason.loggedOut) {
            console.log(`[WhatsApp] Tenant ${tenantId} logged out — deleting auth state.`);
            rm(authDir, { recursive: true, force: true }).catch(() => {});
          }
        }
      }
    });

    // Wait briefly for initial QR or connection.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      status: entry.status,
      qr: entry.qr,
      phoneNumber: entry.phoneNumber,
    };
  }

  /**
   * Disconnect + delete session for a tenant.
   */
  async disconnect(tenantId) {
    const entry = this.sessions.get(tenantId);
    if (entry?.sock) {
      try {
        await entry.sock.logout();
      } catch {
        // ignore — socket may already be closed
      }
    }
    this.sessions.delete(tenantId);
    const authDir = join(AUTH_STATES_DIR, tenantId);
    await rm(authDir, { recursive: true, force: true }).catch(() => {});
    console.log(`[WhatsApp] Tenant ${tenantId} disconnected + auth state deleted.`);
  }

  /**
   * Get current status for a tenant.
   */
  getStatus(tenantId) {
    const entry = this.sessions.get(tenantId);
    if (!entry) return { status: "disconnected", phoneNumber: null, qr: null };
    return {
      status: entry.status,
      phoneNumber: entry.phoneNumber,
      qr: entry.qr,
    };
  }

  /**
   * Send a text message to a phone number.
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async sendMessage(tenantId, phone, message) {
    const entry = this.sessions.get(tenantId);
    if (!entry || entry.status !== "connected") {
      return { success: false, error: "WhatsApp not connected for this tenant" };
    }

    // Normalize phone: strip non-digits, ensure country code.
    let normalized = phone.replace(/\D/g, "");
    if (normalized.startsWith("0")) normalized = "62" + normalized.slice(1);
    if (!normalized.includes("@s.whatsapp.net")) {
      normalized = normalized + "@s.whatsapp.net";
    }

    try {
      await entry.sock.sendMessage(normalized, { text: message });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * On startup: scan auth-states/ + auto-reconnect all saved sessions.
   */
  async reconnectAll() {
    try {
      const dirs = await readdir(AUTH_STATES_DIR);
      for (const tenantId of dirs) {
        // Only auto-reconnect if the auth state has real credential files.
        // An empty dir (QR never scanned) would just generate QRs in a loop.
        const authDir = join(AUTH_STATES_DIR, tenantId);
        const files = await readdir(authDir).catch(() => []);
        if (files.length === 0) {
          console.log(`[WhatsApp] Skipping tenant ${tenantId} — no saved credentials. Waiting for explicit connect.`);
          continue;
        }
        console.log(`[WhatsApp] Auto-reconnecting tenant ${tenantId} (${files.length} cred files)...`);
        this.connect(tenantId).catch((err) => {
          console.error(`[WhatsApp] Failed to reconnect tenant ${tenantId}:`, err.message);
        });
      }
    } catch {
      // auth-states/ doesn't exist yet — fine.
    }
  }
}

export const sessionManager = new SessionManager();
