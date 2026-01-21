"use strict";

/** @typedef {import("./types").VehicleStateRecord} VehicleStateRecord */
/** @typedef {import("./types").HistoryQuery} HistoryQuery */

/**
 * Create an in-memory state store.
 * @param {{ maxHistoryPerVehicle: number }} opts
 * @returns {import("./types").VehicleStateStore}
 */
function createMemoryStore(opts) {
  /** @type {Map<string, VehicleStateRecord>} */
  const current = new Map();
  /** @type {Map<string, VehicleStateRecord[]>} */
  const history = new Map();

  const maxHistory = Number(opts.maxHistoryPerVehicle || 1000);

  return {
    async put(record) {
      current.set(record.vehicleId, record);
      const arr = history.get(record.vehicleId) || [];
      arr.push(record);

      // Keep bounded history for MVP.
      if (arr.length > maxHistory) {
        arr.splice(0, arr.length - maxHistory);
      }
      history.set(record.vehicleId, arr);
    },

    async getCurrent(vehicleId) {
      return current.get(vehicleId) || null;
    },

    async getHistory(vehicleId, query) {
      const arr = history.get(vehicleId) || [];
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

module.exports = { createMemoryStore };
