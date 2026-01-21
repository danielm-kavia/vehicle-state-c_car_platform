"use strict";

/**
 * PUBLIC_INTERFACE
 * Load configuration from environment variables.
 * No secrets are hard-coded; everything comes from process.env.
 *
 * @returns {{
 *  serviceName: string,
 *  port: number,
 *  host: string|undefined,
 *  logLevel: "debug"|"info"|"warn"|"error",
 *  allowedOrigins: string[],
 *  storage: {
 *    driver: "memory"|"file",
 *    dataDir: string,
 *    maxHistoryPerVehicle: number
 *  },
 *  websocket: {
 *    enabled: boolean,
 *    path: string
 *  }
 * }}
 */
function loadConfig() {
  const serviceName = process.env.SERVICE_NAME || "vehicle-state";
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || undefined;
  const logLevel = /** @type {any} */ (process.env.LOG_LEVEL || "info");

  const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const driver = String(process.env.STATE_STORE_DRIVER || "memory").toLowerCase() === "file" ? "file" : "memory";
  const dataDir = process.env.STATE_STORE_DIR || "./data";
  const maxHistoryPerVehicle = Number(process.env.STATE_MAX_HISTORY_PER_VEHICLE || 1000);

  const wsEnabled = String(process.env.WS_ENABLED || "true").toLowerCase() === "true";
  const wsPath = process.env.WS_PATH || "/ws";

  return {
    serviceName,
    port,
    host,
    logLevel,
    allowedOrigins,
    storage: {
      driver,
      dataDir,
      maxHistoryPerVehicle,
    },
    websocket: {
      enabled: wsEnabled,
      path: wsPath,
    },
  };
}

module.exports = { loadConfig };
