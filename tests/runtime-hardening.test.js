import test from "node:test";
import assert from "node:assert/strict";
import { initializePublicApi } from "../scripts/api/public-api.js";
import { createEmptyBlueprint } from "../scripts/core/schemas.js";

function effectBlueprint() {
  const blueprint = createEmptyBlueprint();
  blueprint.identity.name = "Runtime Test";
  blueprint.abilities = [{
    id: "ability-1",
    contentId: "test.ability",
    name: "Test Ability",
    type: "action",
    actionCost: 1,
    category: "offensive",
    traits: [],
    powerCost: 1,
    applications: [{ type: "effect", ref: "effect-1", target: "self", timing: "after-use" }]
  }];
  blueprint.resources.effects = [{
    id: "effect-1",
    contentId: "test.effect",
    definition: { schemaVersion: 2, name: "Test Effect", components: [{ type: "condition", slug: "frightened", value: 1 }] }
  }];
  blueprint.metadata.abilityBudget = { limit: 3, spent: 1, remaining: 2, requestedCount: 1, generatedCount: 1 };
  blueprint.metadata.specialFeatureBudget = { limit: 3, spent: 1, remaining: 2, abilitySpent: 1, auraSpent: 0, afflictionSpent: 0, spellcastingSpent: 0 };
  return blueprint;
}

test("createActor isolates optional runtime integration failures and still runs remaining/external post-create work", async () => {
  const previousGame = globalThis.game;
  const previousActor = globalThis.Actor;
  const previousFolder = globalThis.Folder;
  const moduleRecord = { id: "pf2e-creature-forge", version: "0.7.0", active: true, api: null };
  const effectModule = {
    id: "pf2e-critical-forge", active: true, version: "test",
    api: { effects: { apply: async () => [], createItems: async () => [] } }
  };
  globalThis.game = {
    modules: new Map([["pf2e-creature-forge", moduleRecord], ["pf2e-critical-forge", effectModule]]),
    items: [], folders: [], packs: [],
    i18n: { lang: "en", localize: (key) => key }
  };
  globalThis.Folder = undefined;
  let externalCalled = false;
  globalThis.Actor = {
    create: async (source) => {
      const items = source.items.map((item, index) => ({ ...structuredClone(item), id: `item-${index + 1}`, uuid: `Actor.runtime.Item.item-${index + 1}` }));
      return {
        id: "runtime", uuid: "Actor.runtime", flags: structuredClone(source.flags), items,
        async update() { return this; },
        async updateEmbeddedDocuments() { throw new Error("simulated sheet update failure"); },
        async deleteEmbeddedDocuments() { return []; },
        sheet: { render: () => {} }
      };
    }
  };
  try {
    const api = initializePublicApi();
    const result = await api.createActor(effectBlueprint(), {
      renderSheet: false,
      postCreate: async () => { externalCalled = true; return { ok: true }; }
    });
    assert.equal(result.actor.uuid, "Actor.runtime");
    assert.equal(externalCalled, true);
    assert.ok(result.runtime.creatureForge.diagnostics.some((entry) => entry.subsystem === "effects"));
    assert.equal(result.runtime.creatureForge.runtimeStatus.effects, "failed");
    assert.equal(result.runtime.creatureForge.runtimeStatus.specialFeatures, "ready");
    assert.equal(result.runtime.creatureForge.runtimeStatus.spellcasting, "ready");
    assert.equal(result.runtime.external.ok, true);
  } finally {
    globalThis.game = previousGame;
    globalThis.Actor = previousActor;
    globalThis.Folder = previousFolder;
  }
});

test("runtime status reports degraded when a subsystem completes with per-resource warnings", async () => {
  const previousGame = globalThis.game;
  const previousActor = globalThis.Actor;
  const previousFolder = globalThis.Folder;
  const moduleRecord = { id: "pf2e-creature-forge", version: "0.8.0", active: true, api: null };
  const effectModule = {
    id: "pf2e-critical-forge",
    active: true,
    version: "test",
    api: {
      effects: {
        apply: async () => [],
        createItems: async () => { throw new Error("simulated resource materialization failure"); }
      }
    }
  };
  globalThis.game = {
    modules: new Map([["pf2e-creature-forge", moduleRecord], ["pf2e-critical-forge", effectModule]]),
    items: [], folders: [], packs: [],
    i18n: { lang: "en", localize: (key) => key }
  };
  globalThis.Folder = undefined;
  globalThis.Actor = {
    create: async (source) => {
      const items = source.items.map((item, index) => ({
        ...structuredClone(item),
        id: `item-${index + 1}`,
        uuid: `Actor.degraded.Item.item-${index + 1}`,
        system: structuredClone(item.system),
        flags: structuredClone(item.flags)
      }));
      return {
        id: "degraded",
        uuid: "Actor.degraded",
        flags: structuredClone(source.flags),
        items,
        async update(changes) {
          for (const [key, value] of Object.entries(changes)) {
            if (key === "flags.pf2e-creature-forge.runtimeStatus") this.runtimeStatus = value;
          }
          return this;
        },
        async updateEmbeddedDocuments(_type, updates) {
          for (const update of updates) {
            const item = this.items.find((entry) => entry.id === update._id);
            if (item && update["system.description.value"] !== undefined) item.system.description.value = update["system.description.value"];
          }
          return updates;
        },
        async deleteEmbeddedDocuments() { return []; },
        sheet: { render: () => {} }
      };
    }
  };
  try {
    const api = initializePublicApi();
    const result = await api.createActor(effectBlueprint(), { renderSheet: false });
    assert.equal(result.runtime.creatureForge.runtimeStatus.schemaVersion, 2);
    assert.equal(result.runtime.creatureForge.runtimeStatus.effects, "degraded");
    assert.ok(result.runtime.creatureForge.diagnostics.some((entry) => entry.subsystem === "effects" && entry.level === "warning"));
    assert.equal(result.runtime.creatureForge.runtimeStatus.specialFeatures, "ready");
  } finally {
    globalThis.game = previousGame;
    globalThis.Actor = previousActor;
    globalThis.Folder = previousFolder;
  }
});
