"use strict";

/**
 * Build an OpenAPI 3.0 document for this service.
 *
 * Note: This service validates POST /state against the shared JSON schema
 * `shared-c_car_platform/src/schemas/v1/state-update.v1.schema.json`. The OpenAPI
 * schema below mirrors that contract.
 *
 * @param {{
 *   serviceName: string,
 *   websocket: { enabled: boolean, path: string },
 *   docs?: { enabled: boolean }
 * }} cfg
 * @returns {any} OpenAPI document (plain JSON object)
 */
function buildOpenApiSpec(cfg) {
  const tags = [
    { name: "Health", description: "Service health and metadata." },
    { name: "State", description: "Ingest and query vehicle state." },
    {
      name: "WebSocket",
      description:
        "Optional real-time streaming. This is not part of the OpenAPI HTTP paths, but the service may expose a WS endpoint when enabled.",
    },
  ];

  /** @type {any} */
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "Vehicle State API",
      version: "0.1.0",
      description:
        "Vehicle state service: accepts validated state updates, provides current/history queries, and optional WebSocket streaming.",
    },
    // Relative server works well in previews / reverse proxies.
    servers: [{ url: "/" }],
    tags,
    components: {
      schemas: {
        ErrorResponse: {
          type: "object",
          additionalProperties: false,
          required: ["ok", "error"],
          properties: {
            ok: { type: "boolean", enum: [false] },
            error: { type: "string", description: "Machine-readable error code." },
            details: {
              type: "array",
              description: "Optional validation details.",
              items: {
                type: "object",
                additionalProperties: true,
                properties: {
                  path: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },

        HealthResponse: {
          type: "object",
          additionalProperties: false,
          required: ["ok", "service", "correlationId", "storage", "websocket"],
          properties: {
            ok: { type: "boolean" },
            service: { type: "string" },
            correlationId: { type: "string" },
            storage: {
              type: "object",
              additionalProperties: false,
              required: ["driver"],
              properties: {
                driver: { type: "string", enum: ["memory", "file"] },
              },
            },
            websocket: {
              type: "object",
              additionalProperties: false,
              required: ["enabled", "path"],
              properties: {
                enabled: { type: "boolean" },
                path: { type: "string" },
              },
            },
          },
        },

        // Mirrors shared schema: shared-c_car_platform/src/schemas/v1/state-update.v1.schema.json
        StateUpdateV1: {
          type: "object",
          additionalProperties: false,
          required: ["schemaVersion", "vehicleId", "timestamp", "state"],
          properties: {
            schemaVersion: { type: "string", enum: ["v1"] },
            vehicleId: { type: "string" },
            timestamp: {
              type: "string",
              description: "ISO-8601 timestamp string (validated by the service).",
              example: "2026-01-21T00:00:00.000Z",
            },
            state: {
              type: "object",
              additionalProperties: false,
              required: [],
              properties: {
                speedKph: { type: "number" },
                batteryPct: { type: "number" },
                fuelPct: { type: "number" },
                latitude: { type: "number" },
                longitude: { type: "number" },
              },
            },
          },
        },

        VehicleStateState: {
          type: "object",
          additionalProperties: true,
          description:
            "State bag currently stored/returned by this service. Fields are populated from StateUpdateV1.state.",
          properties: {
            speedKph: { type: "number" },
            batteryPct: { type: "number" },
            fuelPct: { type: "number" },
            latitude: { type: "number" },
            longitude: { type: "number" },
          },
        },

        VehicleStateRecord: {
          type: "object",
          additionalProperties: false,
          required: ["vehicleId", "timestamp", "state"],
          properties: {
            vehicleId: { type: "string" },
            timestamp: { type: "string", description: "ISO-8601 timestamp." },
            state: { $ref: "#/components/schemas/VehicleStateState" },
          },
        },

        AcceptedResponse: {
          type: "object",
          additionalProperties: false,
          required: ["ok"],
          properties: {
            ok: { type: "boolean", enum: [true] },
          },
        },

        CurrentStateResponse: {
          type: "object",
          additionalProperties: false,
          required: ["ok", "item"],
          properties: {
            ok: { type: "boolean", enum: [true] },
            item: { $ref: "#/components/schemas/VehicleStateRecord" },
          },
        },

        HistoryResponse: {
          type: "object",
          additionalProperties: false,
          required: ["ok", "vehicleId", "total", "items", "page"],
          properties: {
            ok: { type: "boolean", enum: [true] },
            vehicleId: { type: "string" },
            total: { type: "number" },
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/VehicleStateRecord" },
            },
            page: {
              type: "object",
              additionalProperties: false,
              required: ["limit", "offset"],
              properties: {
                limit: { type: "number" },
                offset: { type: "number" },
              },
            },
          },
        },

        // Requested by task: a "flattened" payload shape that some clients might use.
        // Not currently the request/response shape for this service, but documented here for clarity.
        VehicleStatePayload: {
          type: "object",
          additionalProperties: false,
          required: ["vehicleId", "timestamp", "speedKph", "fuelLevelPct", "location"],
          description:
            "Reference/flattened payload shape (not the current HTTP contract). The service currently uses `state` fields (speedKph, fuelPct, latitude, longitude).",
          properties: {
            vehicleId: { type: "string" },
            timestamp: { type: "string" },
            speedKph: { type: "number" },
            fuelLevelPct: { type: "number", description: "Equivalent to state.fuelPct." },
            location: {
              type: "object",
              additionalProperties: false,
              required: ["lat", "lon"],
              properties: {
                lat: { type: "number", description: "Equivalent to state.latitude." },
                lon: { type: "number", description: "Equivalent to state.longitude." },
              },
            },
          },
        },
      },
    },
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          description: "Returns service health and runtime metadata.",
          responses: {
            200: {
              description: "OK",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HealthResponse" },
                },
              },
            },
          },
        },
      },

      "/state": {
        post: {
          tags: ["State"],
          summary: "Ingest a vehicle state update",
          description:
            "Accepts a StateUpdateV1 payload, validates it, stores it as current + history, and broadcasts to WebSocket subscribers (if enabled).",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StateUpdateV1" },
                example: {
                  schemaVersion: "v1",
                  vehicleId: "VIN123",
                  timestamp: "2026-01-21T00:00:00.000Z",
                  state: {
                    speedKph: 40,
                    batteryPct: 90,
                    latitude: 37.77,
                    longitude: -122.41,
                  },
                },
              },
            },
          },
          responses: {
            202: {
              description: "Accepted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AcceptedResponse" },
                },
              },
            },
            400: {
              description: "Bad Request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },

      "/state/{vehicleId}/current": {
        get: {
          tags: ["State"],
          summary: "Get current state for a vehicle",
          description: "Returns the last-known (current) state for the given vehicleId.",
          parameters: [
            {
              name: "vehicleId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "OK",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CurrentStateResponse" },
                },
              },
            },
            400: {
              description: "Bad Request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            404: {
              description: "Not Found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },

      "/state/{vehicleId}/history": {
        get: {
          tags: ["State"],
          summary: "Get historical state for a vehicle",
          description:
            "Returns paginated history for the given vehicleId. Optional time range filters are inclusive.",
          parameters: [
            {
              name: "vehicleId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "from",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "ISO timestamp (inclusive).",
            },
            {
              name: "to",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "ISO timestamp (inclusive).",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 1000, default: 100 },
            },
            {
              name: "offset",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 0, default: 0 },
            },
          ],
          responses: {
            200: {
              description: "OK",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HistoryResponse" },
                },
              },
            },
            400: {
              description: "Bad Request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
    },
    "x-websocket": {
      enabled: Boolean(cfg.websocket && cfg.websocket.enabled),
      path: cfg.websocket && cfg.websocket.path ? cfg.websocket.path : "/ws",
      protocol: {
        subscribe: { type: "subscribe", vehicleId: "VIN123" },
        unsubscribe: { type: "unsubscribe", vehicleId: "VIN123" },
        serverPush: { type: "state", vehicleId: "VIN123", timestamp: "...", state: { speedKph: 40 } },
      },
      note:
        "When WS is enabled, connect to the path above and send subscribe/unsubscribe messages. Server will push `type=state` updates.",
    },
  };

  return spec;
}

module.exports = { buildOpenApiSpec };
