import test from "node:test";
import assert from "node:assert/strict";
import { ForgeIntegrationHub } from "../scripts/integration/adapters.js";

function fn() { return () => {}; }

function currentForgeApis() {
  return {
    "pf2e-critical-forge": {
      version: "1.0.1",
      effects: {
        validate: fn(), analyze: fn(), compile: fn(), toItemSource: fn(), toItemSources: fn(),
        createItem: fn(), createItems: fn(), apply: fn(), execute: fn(), checkCompatibility: fn()
      },
      ui: { effectEditor: { create: fn() } }
    },
    "pf2e-aura-forge": {
      version: "1.0.0",
      definitions: { create: fn(), validate: fn() },
      instances: { assignDefinition: fn(), reconcileActor: fn() },
      ui: { auraEditor: { create: fn() } }
    },
    "pf2e-affliction-forge": {
      version: "0.1.63",
      definitions: { create: fn(), validate: fn() },
      engine: { applyDefinition: fn(), applyTemplate: fn() },
      instances: { reconcileActor: fn() },
      documents: { buildTemplateSource: fn() },
      references: { create: fn(), add: fn(), get: fn(), list: fn() },
      libraries: { list: fn(), templates: fn() },
      templates: { read: fn() },
      triggers: { status: fn() },
      ui: { afflictionEditor: { create: fn() } }
    },
    "pf2e-item-forge": { apiVersion: "0.0.37", generate: fn() },
    "pf2e-loot-forge": {
      createEmbeddedEditor: fn(), generateLootForCreature: fn(), generateInventoryForCreature: fn(),
      addLootToActor: fn(), createLootActorWithLoot: fn()
    }
  };
}

test("current optional Forge API surfaces report complete integration contracts", () => {
  const previousGame = globalThis.game;
  const apis = currentForgeApis();
  globalThis.game = {
    modules: new Map(Object.entries(apis).map(([id, api]) => [id, { id, active: true, version: `${id}-test`, api }]))
  };
  try {
    const status = new ForgeIntegrationHub().status();
    for (const [id, entry] of Object.entries(status)) {
      assert.equal(entry.active, true, id);
      assert.equal(entry.ready, true, id);
      assert.equal(entry.complete, true, `${id}: ${entry.missingCapabilities.join(", ")}`);
      assert.deepEqual(entry.missingCapabilities, [], id);
    }
    assert.equal(status.item.capabilities.generate, true);
    assert.equal(status.aura.capabilities.reconcileActor, true);
    assert.equal(status.affliction.capabilities.applyTemplate, true);
  } finally {
    globalThis.game = previousGame;
  }
});

test("integration diagnostics distinguish an exposed API from an incomplete contract", () => {
  const previousGame = globalThis.game;
  const apis = currentForgeApis();
  delete apis["pf2e-item-forge"].generate;
  globalThis.game = {
    modules: new Map(Object.entries(apis).map(([id, api]) => [id, { id, active: true, version: "test", api }]))
  };
  try {
    const item = new ForgeIntegrationHub().status().item;
    assert.equal(item.ready, true);
    assert.equal(item.complete, false);
    assert.deepEqual(item.missingCapabilities, ["generate"]);
  } finally {
    globalThis.game = previousGame;
  }
});
