"use strict";

const fs = require("fs");
const path = require("path");

/** @typedef {import("./types").VehicleStateRecord} VehicleStateRecord */

/**
 * Ensure directory exists (sync is OK for startup/local dev).
 * @param {string} dir
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Read JSON file if it exists.
 * @param {string} fp
 * @returns {any|null}
 */
function readJsonIfExists(fp) {
  try {
    if (!fs.existsSync(fp)) return null;
    const raw = fs.readFileSync(fp, "utf8");
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Atomic-ish write: write temp then rename.
 * @param {string} fp
 * @param {any} obj
 */
function writeJson(fp, obj) {
  const tmp = `${fp}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, fp);
}

/**
 * Create a file-backed store with one file per vehicle to keep it simple.
 *
 * @param {{ dataDir: string, maxHistoryPerVehicle: number }} opts
 * @returns {import("./types").VehicleStateStore}
 */
function createFileStore(opts) {
  const dataDir = opts.dataDir || "./data";
  const maxHistory = Number(opts.maxHistoryPerVehicle || 1000);

  ensureDir(dataDir);

  /**
   * @param {string} vehicleId
   */
  function filePathForVehicle(vehicleId) {
    // Keep filename safe.
    const safe = vehicleId.replace(/[^a-zA-Z0-9._-]/g, "_");
    return path.join(dataDir, `${safe}.json`);
  }

  return {
    async put(record) {
      const fp = filePathForVehicle(record.vehicleId);
      /** @type {{ current: VehicleStateRecord|null, history: VehicleStateRecord[] }} */
      const existing = readJsonIfExists(fp) || { current: null, history: [] };

      existing.current = record;
      existing.history = Array.isArray(existing.history) ? existing.history : [];
      existing.history.push(record);

      if (existing.history.length > maxHistory) {
        existing.history.splice(0, existing.history.length - maxHistory);
      }

      writeJson(fp, existing);
    },

    async getCurrent(vehicleId) {
      const fp = filePathForVehicle(vehicleId);
      const existing = readJsonIfExists(fp);
      return existing && existing.current ? existing.current : null;
    },

    async getHistory(vehicleId, query) {
      const fp = filePathForVehicle(vehicleId);
      const existing = readJsonIfExists(fp) || { history: [] };
      const arr = Array.isArray(existing.history) ? existing.history : [];

      const from = query.from ? new Date(query.from) : null;
      const to = query.to ? new Date(query.to) : null;

      let filtered = arr;

      if (from && Number.isFinite(from.getTime())) {
        filtered = filtered.filter((r) => new Date(r.timestamp).getTime() >= from.getTime());
      }
      if (to && Number.isFinite(to.getTime())) {
        filtered = filtered.filter((r) => new Date(r.timestamp).getTime() <= to.getTime());
      }

      const total = filtered.length;
      const limit = Number.isFinite(Number(query.limit)) ? Math.max(1, Math.min(1000, Number(query.limit))) : 100;
      const offset = Number.isFinite(Number(query.offset)) ? Math.max(0, Number(query.offset)) : 0;

      const items = filtered.slice(offset, offset + limit);
      return { items, total };
    },
  };
}

module.exports = { createFileStore };
