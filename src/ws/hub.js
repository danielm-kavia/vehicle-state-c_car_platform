"use strict";

const { WebSocketServer } = require("ws");

/**
 * Create a WebSocket hub attached to an existing HTTP server.
 *
 * Protocol:
 * - Client connects to WS_PATH (default /ws)
 * - Client can send JSON:
 *   { "type": "subscribe", "vehicleId": "..." }
 *   { "type": "unsubscribe", "vehicleId": "..." }
 *
 * Server broadcasts JSON:
 *   { "type": "state", "vehicleId": "...", "timestamp": "...", "state": {...} }
 *
 * @param {{ server: import("http").Server, path: string }} opts
 * @param {{ info: Function, warn: Function, error: Function }} logger
 */
function createWebSocketHub(opts, logger) {
  /** @type {Map<string, Set<import("ws").WebSocket>>} */
  const subscribers = new Map();

  const wss = new WebSocketServer({ server: opts.server, path: opts.path });

  function subscribe(ws, vehicleId) {
    const set = subscribers.get(vehicleId) || new Set();
    set.add(ws);
    subscribers.set(vehicleId, set);
  }

  function unsubscribe(ws, vehicleId) {
    const set = subscribers.get(vehicleId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) subscribers.delete(vehicleId);
  }

  wss.on("connection", (ws) => {
    /** @type {Set<string>} */
    const mySubs = new Set();

    ws.on("message", (buf) => {
      let msg;
      try {
        msg = JSON.parse(String(buf));
      } catch (_) {
        return;
      }
      if (!msg || typeof msg !== "object") return;

      if (msg.type === "subscribe" && typeof msg.vehicleId === "string") {
        mySubs.add(msg.vehicleId);
        subscribe(ws, msg.vehicleId);
      }
      if (msg.type === "unsubscribe" && typeof msg.vehicleId === "string") {
        mySubs.delete(msg.vehicleId);
        unsubscribe(ws, msg.vehicleId);
      }
    });

    ws.on("close", () => {
      for (const vid of mySubs) unsubscribe(ws, vid);
    });
  });

  return {
    /**
     * PUBLIC_INTERFACE
     * Broadcast a state update to subscribers of that vehicleId.
     * @param {{ vehicleId: string, timestamp: string, state: any }} update
     */
    broadcast(update) {
      const set = subscribers.get(update.vehicleId);
      if (!set || set.size === 0) return;

      const payload = JSON.stringify({ type: "state", ...update });
      for (const ws of set) {
        try {
          if (ws.readyState === ws.OPEN) ws.send(payload);
        } catch (e) {
          logger.warn("WS send failed", { error: String(e && e.message ? e.message : e) });
        }
      }
    },

    /**
     * PUBLIC_INTERFACE
     * Stop accepting connections and close clients.
     */
    close() {
      try {
        wss.close();
      } catch (_) {}
    },
  };
}

module.exports = { createWebSocketHub };
