"use strict";

const { createMemoryStore } = require("./memoryStore");
const { createFileStore } = require("./fileStore");

/**
 * PUBLIC_INTERFACE
 * Create a vehicle state store (memory by default, file-backed for local persistence).
 *
 * @param {{ driver: "memory"|"file", dataDir: string, maxHistoryPerVehicle: number }} cfg
 * @param {{ warn: Function }} logger
 * @returns {import("./types").VehicleStateStore}
 */
function createStore(cfg, logger) {
  if (cfg.driver === "file") {
    return createFileStore({ dataDir: cfg.dataDir, maxHistoryPerVehicle: cfg.maxHistoryPerVehicle });
  }
  if (cfg.driver !== "memory") {
    logger.warn("Unknown STATE_STORE_DRIVER; falling back to memory", { driver: cfg.driver });
  }
  return createMemoryStore({ maxHistoryPerVehicle: cfg.maxHistoryPerVehicle });
}

module.exports = { createStore };
