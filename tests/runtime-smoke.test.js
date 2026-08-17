import test from "node:test";
import assert from "node:assert/strict";

test("module init/ready smoke test exposes API and fires hooks", async () => {
  const once = new Map();
  const calls = [];
  const moduleRecord = { id: "pf2e-creature-forge", version: "0.5.1", active: true, api: null };
  globalThis.HTMLElement = class HTMLElement {};
  globalThis.document = { querySelector: () => null };
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: class {},
        HandlebarsApplicationMixin: (Base) => class extends Base {}
      }
    },
    utils: {
      deepClone: (value) => structuredClone(value),
      mergeObject: (a, b) => ({ ...(a ?? {}), ...(b ?? {}), position: { ...(a?.position ?? {}), ...(b?.position ?? {}) } })
    }
  };
  globalThis.Hooks = {
    once: (name, fn) => once.set(name, fn),
    on: () => {},
    callAll: (name, ...args) => calls.push([name, ...args])
  };
  globalThis.game = {
    user: { isGM: true },
    modules: new Map([["pf2e-creature-forge", moduleRecord]]),
    settings: { register: () => {}, get: () => ({}), set: async () => {} },
    i18n: { localize: (key) => key },
    packs: []
  };
  globalThis.ui = { notifications: { error: () => {}, warn: () => {}, info: () => {} } };

  await import(`../scripts/main.js?smoke=${Date.now()}`);
  assert.equal(typeof once.get("init"), "function");
  assert.equal(typeof once.get("ready"), "function");
  once.get("init")();
  assert.equal(typeof moduleRecord.api?.generate, "function");
  once.get("ready")();
  assert.ok(calls.some(([name]) => name === "pf2eCreatureForgeReady"));
  assert.ok(calls.some(([name]) => name === "pf2eCreatureForgeContentReady"));
});
