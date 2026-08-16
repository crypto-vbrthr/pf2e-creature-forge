import test from "node:test";
import assert from "node:assert/strict";
import { initializePublicApi } from "../scripts/api/public-api.js";

test("public Effect bridge delegates validation, analysis, compile, and item-source operations", async () => {
  const previousGame = globalThis.game;
  const calls = [];
  const criticalApi = {
    effects: {
      validate: (definition) => { calls.push(["validate", definition.id]); return { valid: true, errors: [], warnings: [] }; },
      analyze: (definition, context) => { calls.push(["analyze", definition.id, context.level]); return { valid: true, errors: [], warnings: [], power: 1 }; },
      compile: async (definition, context) => { calls.push(["compile", definition.id, context.level]); return { compiled: true }; },
      toItemSource: async (definition, context) => { calls.push(["toItemSource", definition.id, context.level]); return { type: "effect", name: definition.name }; },
      apply: async (definition, targets) => { calls.push(["apply", definition.id, targets.length]); return { applied: true }; },
      execute: async (definition, targets) => { calls.push(["execute", definition.id, targets.length]); return { executed: true }; },
      checkCompatibility: async (definition, target) => { calls.push(["compatibility", definition.id, target.id]); return { compatible: true }; }
    },
    ui: { effectEditor: { create: () => ({}) } },
    version: "1.0.0"
  };
  const creatureRecord = { id: "pf2e-creature-forge", version: "0.3.2", active: true, api: null };
  globalThis.game = {
    modules: new Map([
      ["pf2e-creature-forge", creatureRecord],
      ["pf2e-critical-forge", { id: "pf2e-critical-forge", version: "1.0.0", active: true, api: criticalApi }]
    ]),
    packs: [],
    settings: { get: () => ({}), set: async () => {} }
  };
  try {
    const api = initializePublicApi();
    const definition = { id: "test.effect", name: "Test", components: [] };
    assert.equal(api.effects.available, true);
    assert.equal(api.effects.validate(definition).valid, true);
    assert.equal(api.effects.analyze(definition, { level: 7 }).power, 1);
    assert.deepEqual(await api.effects.compile(definition, { level: 7 }), { compiled: true });
    assert.deepEqual(await api.effects.toItemSource(definition, { level: 7 }), { type: "effect", name: "Test" });
    assert.deepEqual(await api.effects.apply(definition, [{ id: "target-1" }]), { applied: true });
    assert.deepEqual(await api.effects.execute(definition, [{ id: "target-1" }]), { executed: true });
    assert.deepEqual(await api.effects.checkCompatibility(definition, { id: "target-1" }), { compatible: true });
    const status = api.integrations.getStatus().effect;
    assert.equal(status.ready, true);
    assert.equal(status.capabilities.editor, true);
    assert.equal(status.capabilities.execute, true);
    assert.equal(status.capabilities.checkCompatibility, true);
    assert.deepEqual(calls.map((entry) => entry[0]), ["validate", "analyze", "compile", "toItemSource", "apply", "execute", "compatibility"]);
  } finally {
    globalThis.game = previousGame;
  }
});
