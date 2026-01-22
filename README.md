# vehicle-state-c_car_platform

Vehicle State service (Phase 4 MVP).

This service:
- Accepts validated vehicle state updates (`POST /state`) using shared schema `state-update v1`
- Persists **current** + **historical** state (MVP storage adapter: memory or file)
- Provides query endpoints for **current** and **history**
- Optionally broadcasts state updates over **WebSocket** for real-time UIs

## API

## Swagger / OpenAPI docs

When `DOCS_ENABLED=true` (default in local development), the service exposes:

- Swagger UI: http://localhost:3001/docs
- OpenAPI JSON: http://localhost:3001/openapi.json

To disable docs (recommended for hardened production deployments), set:

- `DOCS_ENABLED=false`

> Note: `/docs` loads Swagger UI assets from a CDN. If you enable a strict CSP, you may need to allow the required script/style sources or disable docs.


### Health
- `GET /health`

### Update state (ingestion -> state)
- `POST /state`

Body must conform to `shared-c_car_platform/src/schemas/v1/state-update.v1.schema.json`:

```json
{
  "schemaVersion": "v1",
  "vehicleId": "VIN123",
  "timestamp": "2026-01-21T00:00:00.000Z",
  "state": {
    "speedKph": 40,
    "batteryPct": 90,
    "latitude": 37.77,
    "longitude": -122.41
  }
}
```

Returns `202 Accepted` on success.

### Get current state
- `GET /state/{vehicleId}/current`

Returns `404` if no state has been recorded.

### Get history (pagination + time range)
- `GET /state/{vehicleId}/history?from=...&to=...&limit=100&offset=0`

- `from`/`to` are ISO timestamps (inclusive)
- `limit` defaults to `100`, max `1000`
- `offset` defaults to `0`

## WebSocket (optional)

If `WS_ENABLED=true`, the service exposes a WS endpoint at `WS_PATH` (default `/ws`).

Client can subscribe/unsubscribe:

```json
{ "type": "subscribe", "vehicleId": "VIN123" }
{ "type": "unsubscribe", "vehicleId": "VIN123" }
```

Server pushes:

```json
{ "type": "state", "vehicleId": "VIN123", "timestamp": "...", "state": { ... } }
```

## Local development

### Environment
Copy and edit:
- `.env.example` -> `.env`

### Install & run
```bash
npm install
npm run dev
```

## Notes / future evolution

- Storage is currently an adapter (`memory` or simple `file` JSON per vehicle). It is intentionally designed to be replaced by DynamoDB/Timescale later without changing API handlers.
- Payload validation uses `@connected-car/shared` schemas (no heavy JSON-schema runtime dependency for MVP).
