import express from "express";
import { sessionManager } from "./session-manager.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// ── Health ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), sessions: sessionManager.sessions.size });
});

// ── Per-tenant endpoints ────────────────────────────────────────────────

// GET /:tenantId/status — connection status (no QR here, use /:tenantId/qr for QR).
app.get("/:tenantId/status", (req, res) => {
  const status = sessionManager.getStatus(req.params.tenantId);
  res.json({ ...status, qr: undefined });
});

// GET /:tenantId/qr — returns the latest QR code (base64 PNG) if connecting.
app.get("/:tenantId/qr", (req, res) => {
  const status = sessionManager.getStatus(req.params.tenantId);
  if (status.status === "connected") {
    return res.json({ status: "connected", qr: null, phoneNumber: status.phoneNumber });
  }
  if (status.qr) {
    return res.json({ status: status.status, qr: status.qr });
  }
  // No QR yet — trigger a connect attempt which will generate one.
  res.json({ status: status.status || "disconnected", qr: null, hint: "POST /:tenantId/connect to start" });
});

// POST /:tenantId/connect — initiate or refresh the WhatsApp session.
app.post("/:tenantId/connect", async (req, res) => {
  try {
    const result = await sessionManager.connect(req.params.tenantId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:tenantId/disconnect — logout + delete auth state.
app.post("/:tenantId/disconnect", async (req, res) => {
  try {
    await sessionManager.disconnect(req.params.tenantId);
    res.json({ status: "disconnected" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:tenantId/send — send a text message.
app.post("/:tenantId/send", async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: "phone and message are required" });
  }
  try {
    const result = await sessionManager.sendMessage(req.params.tenantId, phone, message);
    if (!result.success) {
      return res.status(503).json({ error: result.error });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Startup ─────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`[WhatsApp Gateway] Listening on :${PORT}`);
  console.log("[WhatsApp Gateway] Auto-reconnecting saved sessions...");
  await sessionManager.reconnectAll();
  console.log(`[WhatsApp Gateway] Ready. Active sessions: ${sessionManager.sessions.size}`);
});
