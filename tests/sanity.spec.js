"use strict";

const { loadConfig } = require("../src/config");

describe("vehicle-state baseline", () => {
  test("loadConfig returns expected shape", () => {
    const cfg = loadConfig();

    expect(cfg).toBeTruthy();
    expect(typeof cfg.serviceName).toBe("string");
    expect(typeof cfg.port).toBe("number");
    expect(cfg.storage).toBeTruthy();
    expect(["memory", "file"]).toContain(cfg.storage.driver);
    expect(cfg.websocket).toBeTruthy();
    expect(typeof cfg.websocket.enabled).toBe("boolean");
  });
});
