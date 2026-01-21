"use strict";

/**
 * @typedef {Object} VehicleStateRecord
 * @property {string} vehicleId
 * @property {string} timestamp ISO-8601 timestamp
 * @property {Object} state
 * @property {number=} state.speedKph
 * @property {number=} state.batteryPct
 * @property {number=} state.fuelPct
 * @property {number=} state.latitude
 * @property {number=} state.longitude
 */

/**
 * @typedef {Object} HistoryQuery
 * @property {string=} from ISO-8601 timestamp (inclusive)
 * @property {string=} to ISO-8601 timestamp (inclusive)
 * @property {number=} limit max number of records (default 100)
 * @property {number=} offset pagination offset (default 0)
 */

/**
 * @typedef {Object} VehicleStateStore
 * @property {(record: VehicleStateRecord) => Promise<void>} put Append record and update current.
 * @property {(vehicleId: string) => Promise<VehicleStateRecord|null>} getCurrent
 * @property {(vehicleId: string, query: HistoryQuery) => Promise<{ items: VehicleStateRecord[], total: number }>} getHistory
 */

module.exports = {};
