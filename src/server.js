"use strict";

const http = require("http");
const express = require("express");
const {
  createLogger,
  withCorrelationId,
  getCorrelationId,
  validateAgainstSchema,
  schemas,
  createSecurityHeadersMiddleware,
  createRateLimitMiddleware,
} = require("@connected-car/shared");

const { loadConfig } = require("./config");
const { createStore } = require("./storage");
const { createWebSocketHub } = require("./ws/hub");

const cfg = loadConfig();
const logger = createLogger({ serviceName: cfg.serviceName, level: cfg.logLevel });
const store = createStore(cfg.storage, logger);

const app = express();

// Hardening (Phase 9): security headers + optional rate limiting (disabled by default).
app.use(
  createSecurityHeadersMiddleware({
    serviceName: cfg.serviceName,
    enabled: true,
    enableCsp: String(process.env.SECURITY_ENABLE_CSP || "false").toLowerCase() === "true",
    csp: process.env.SECURITY_CSP || undefined,
    enableHsts: String(process.env.SECURITY_ENABLE_HSTS || "false").toLowerCase() === "true",
  })
);
app.use(
  createRateLimitMiddleware({
    enabled: String(process.env.RATE_LIMIT_ENABLED || "false").toLowerCase() === "true",
    windowSeconds: Number(process.env.RATE_LIMIT_WINDOW_S || 60),
    maxRequests: Number(process.env.RATE_LIMIT_MAX || 100),
    logger,
  })
);

app.use(express.json({ limit: "256kb" })); // keep payloads bounded

// Very small CORS for local dev and previews.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && cfg.allowedOrigins.includes(String(origin))) {
    res.setHeader("Access-Control-Allow-Origin", String(origin));
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
});

/**
 * PUBLIC_INTERFACE
 * Health endpoint.
 */
app.get(
  "/health",
  withCorrelationId(logger, async (req, res) => {
    res.json({
      ok: true,
      service: cfg.serviceName,
      correlationId: getCorrelationId(),
      storage: { driver: cfg.storage.driver },
      websocket: { enabled: cfg.websocket.enabled, path: cfg.websocket.path },
    });
  })
);

/**
 * PUBLIC_INTERFACE
 * POST /state
 * Accepts a StateUpdateV1 payload (shared schema: schemas.stateUpdate.v1),
 * validates it, persists as both current and historical record, and broadcasts
 * to WebSocket subscribers (if enabled).
 */
app.post(
  "/state",
  withCorrelationId(logger, async (req, res) => {
    const payload = req.body;

    const validation = validateAgainstSchema(schemas.stateUpdate.v1, payload);
    if (!validation.ok) {
      return res.status(400).json({ ok: false, error: "schema_validation_failed", details: validation.errors });
    }

    const update = /** @type {any} */ (payload);
    const d = new Date(update.timestamp);
    if (!Number.isFinite(d.getTime())) {
      return res.status(400).json({ ok: false, error: "invalid_timestamp", details: [{ path: "$.timestamp", message: "timestamp must be a valid date string" }] });
    }

    const record = {
      vehicleId: String(update.vehicleId),
      timestamp: d.toISOString(),
      state: update.state || {},
    };

    await store.put(record);

    // broadcast if WS enabled and hub exists
    if (app.locals.wsHub) {
      app.locals.wsHub.broadcast(record);
    }

    return res.status(202).json({ ok: true });
  })
);

/**
 * PUBLIC_INTERFACE
 * GET /state/:vehicleId/current
 * Returns the last-known (current) state for vehicleId.
 */
app.get(
  "/state/:vehicleId/current",
  withCorrelationId(logger, async (req, res) => {
    const vehicleId = String(req.params.vehicleId || "");
    if (!vehicleId) return res.status(400).json({ ok: false, error: "vehicleId_required" });

    const current = await store.getCurrent(vehicleId);
    if (!current) return res.status(404).json({ ok: false, error: "not_found" });

    return res.status(200).json({ ok: true, item: current });
  })
);

/**
 * PUBLIC_INTERFACE
 * GET /state/:vehicleId/history
 * Query parameters:
 * - from (ISO string, inclusive)
 * - to (ISO string, inclusive)
 * - limit (default 100, max 1000)
 * - offset (default 0)
 */
app.get(
  "/state/:vehicleId/history",
  withCorrelationId(logger, async (req, res) => {
    const vehicleId = String(req.params.vehicleId || "");
    if (!vehicleId) return res.status(400).json({ ok: false, error: "vehicleId_required" });

    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const offset = typeof req.query.offset === "string" ? Number(req.query.offset) : undefined;

    const result = await store.getHistory(vehicleId, { from, to, limit, offset });

    return res.status(200).json({
      ok: true,
      vehicleId,
      total: result.total,
      items: result.items,
      page: {
        limit: Number.isFinite(Number(limit)) ? limit : 100,
        offset: Number.isFinite(Number(offset)) ? offset : 0,
      },
    });
  })
);

async function main() {
  // Use an explicit HTTP server so we can attach WebSocket.
  const server = http.createServer(app);

  if (cfg.websocket.enabled) {
    const hub = createWebSocketHub({ server, path: cfg.websocket.path }, logger);
    app.locals.wsHub = hub;
  }

  server.listen(cfg.port, cfg.host || "0.0.0.0", () => {
    logger.info("Vehicle state server listening", { port: cfg.port });
  });

  process.on("SIGINT", async () => {
    try {
      if (app.locals.wsHub) app.locals.wsHub.close();
    } catch (_) {}
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    try {
      if (app.locals.wsHub) app.locals.wsHub.close();
    } catch (_) {}
    process.exit(0);
  });
}

main().catch((e) => {
  logger.error("Fatal startup error", { error: String(e && e.message ? e.message : e) });
  // Keep process alive for previews where possible.
});
