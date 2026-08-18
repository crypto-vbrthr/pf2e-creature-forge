import test from "node:test";
import assert from "node:assert/strict";
import { createLootPlan, lootChannelChance } from "../scripts/core/loot.js";
import { createGenerationRequest, createEmptyBlueprint } from "../scripts/core/schemas.js";
import { createRandom } from "../scripts/core/rng.js";
import { CreatureLootIntegration } from "../scripts/integration/loot-integration.js";
import { CreatureLootRuntime, summarizeDeferredLoot } from "../scripts/runtime/loot-runtime.js";
import { MODULE_ID } from "../scripts/constants.js";

function blueprint(category = "humanoid", role = "soldier", level = 8) {
  const value = createEmptyBlueprint();
  value.identity = { ...value.identity, name: "Loot Test", category, role, level, traits: [category] };
  value.metadata.seed = "loot-test";
  value.metadata.requestSnapshot = createGenerationRequest({ identity: { category, role, level }, generation: { seed: "loot-test" } });
  return value;
}

test("loot planner keeps channels concept-sensitive and deterministic for a seed", () => {
  const request = createGenerationRequest({
    identity: { category: "animal", role: "brute", level: 6 },
    generation: { seed: "animal-loot" },
    loot: { mode: "auto" }
  });
  const bp = blueprint("animal", "brute", 6);
  const first = createLootPlan({ request, blueprint: bp, random: createRandom("animal-loot").fork("loot") });
  const second = createLootPlan({ request, blueprint: bp, random: createRandom("animal-loot").fork("loot") });
  assert.deepEqual(first.summary.selectedChannels, second.summary.selectedChannels);
  assert.equal(first.channels.equipment.chance, 0.08);
  assert.ok(first.channels.salvage.chance > first.channels.equipment.chance);
  assert.equal(lootChannelChance({ channel: "signature", category: "animal", roleId: "brute", level: 1 }), 0);
});

test("required loot channels are selected even when their automatic chance is zero", () => {
  const request = createGenerationRequest({
    identity: { category: "animal", role: "brute", level: 1 },
    generation: { seed: "required-signature" },
    loot: { mode: "auto", signature: { mode: "required" }, equipment: { mode: "none" }, salvage: { mode: "none" }, hoard: { mode: "none" } }
  });
  const plan = createLootPlan({ request, blueprint: blueprint("animal", "brute", 1), random: createRandom("required-signature").fork("loot") });
  assert.equal(plan.channels.signature.chance, 0);
  assert.equal(plan.channels.signature.selected, true);
  assert.equal(plan.channels.signature.reason, "required");
});

test("Loot/Item Forge integration uses host-local selected compendiums and keeps deferred channels separate", async () => {
  const calls = { inventory: [], hoard: [], item: [] };
  const integrations = {
    lootApi: {
      generateInventoryForCreature: async (request) => {
        calls.inventory.push(structuredClone(request));
        return { combatGear: [{ name: "Steel Spear", type: "weapon", system: {} }] };
      },
      generateLootForCreature: async (request) => {
        calls.hoard.push(structuredClone(request));
        return { coins: { gp: 12 }, pf2eItems: [{ name: "Gem", type: "treasure", system: {} }], generatedItems: [], totalValueGp: 12 };
      }
    },
    itemApi: {
      generate: async (request) => {
        calls.item.push(structuredClone(request));
        return { itemSource: { name: "Signature Blade", type: "weapon", system: {} }, metadata: { test: true } };
      }
    }
  };
  const bp = blueprint("humanoid", "soldier", 8);
  bp.loot = {
    schemaVersion: 2, policy: "required", generated: false, environment: "urban", treasureProfile: "standard", useItemForge: true,
    channels: {
      equipment: { mode: "required", selected: true, result: null },
      salvage: { mode: "required", selected: true, result: null },
      hoard: { mode: "required", selected: true, result: null },
      signature: { mode: "required", selected: true, result: null }
    }, diagnostics: [], summary: {}
  };
  const request = createGenerationRequest({ loot: { mode: "required", environment: "urban" }, sources: { loot: ["pf2e.equipment-srd", "world.custom-items"] } });
  const result = await new CreatureLootIntegration({ integrations }).generateForBlueprint(bp, request);
  assert.equal(result.loot.generated, true);
  assert.equal(result.loot.channels.equipment.result.provider, "loot-forge");
  assert.equal(result.loot.channels.signature.result.provider, "item-forge");
  assert.equal(result.loot.channels.hoard.result.provider, "loot-forge");
  assert.equal(result.loot.channels.salvage.result.provider, MODULE_ID);
  assert.deepEqual(calls.inventory[0].compendiums, ["pf2e.equipment-srd", "world.custom-items"]);
  assert.deepEqual(calls.hoard[0].compendiums, ["pf2e.equipment-srd", "world.custom-items"]);
  assert.equal(calls.item[0].source.mode, "selected");
  assert.deepEqual(calls.item[0].source.includePacks, ["pf2e.equipment-srd", "world.custom-items"]);
});

test("signature generation falls back to Loot Forge when Item Forge fails", async () => {
  const integrations = {
    itemApi: { generate: async () => { throw new Error("no matching item"); } },
    lootApi: { generateInventoryForCreature: async () => ({ combatGear: [{ name: "Fallback Axe", type: "weapon", system: {} }] }) }
  };
  const bp = blueprint();
  bp.loot = {
    schemaVersion: 2, policy: "required", generated: false, environment: "generic", useItemForge: true,
    channels: { equipment: { selected: false }, salvage: { selected: false }, hoard: { selected: false }, signature: { mode: "required", selected: true, result: null } }, diagnostics: [], summary: {}
  };
  const result = await new CreatureLootIntegration({ integrations }).generateForBlueprint(bp, createGenerationRequest({ loot: { signature: { mode: "required" } } }));
  assert.equal(result.loot.channels.signature.result.provider, "loot-forge-fallback");
  assert.equal(result.loot.channels.signature.result.items[0].name, "Fallback Axe");
  assert.ok(result.loot.diagnostics.some((entry) => entry.code === "SIGNATURE_ITEM_GENERATION_FAILED"));
});

test("runtime materializes only carried equipment/signature and persists salvage/hoard as deferred loot", async () => {
  const bp = blueprint();
  bp.loot = {
    schemaVersion: 2, generated: true, summary: { carriedItemCount: 2, deferredItemCount: 2 },
    channels: {
      equipment: { result: { items: [{ name: "Spear", type: "weapon", system: {} }] } },
      signature: { result: { items: [{ name: "Rune Amulet", type: "equipment", system: {} }] } },
      salvage: { result: { entries: [{ id: "hide", nameKey: "PF2E_CREATURE_FORGE.Loot.Salvage.AnimalParts", fallbackName: "Hide", quantity: 1, valueGp: 2 }] } },
      hoard: { result: { loot: { pf2eItems: [{ name: "Hoard Gem", type: "treasure", system: {} }], generatedItems: [] }, items: [{ name: "Hoard Gem", type: "treasure", system: {} }] } }
    }
  };
  const createdSources = [];
  const updates = [];
  const actor = {
    flags: { [MODULE_ID]: { loot: { materialized: { hoard: { actorId: "existing-loot", channels: ["hoard"] } } } } },
    items: [{ id: "old", flags: { [MODULE_ID]: { loot: { managed: true, channel: "equipment" } } } }],
    async deleteEmbeddedDocuments(_type, ids) { assert.deepEqual(ids, ["old"]); this.items = []; return ids; },
    async createEmbeddedDocuments(_type, sources) { createdSources.push(...structuredClone(sources)); return sources.map((source, i) => ({ ...source, id: `new-${i}` })); },
    async update(update) { updates.push(structuredClone(update)); return this; }
  };
  const result = await new CreatureLootRuntime({ integrations: {} }).materialize(actor, bp);
  assert.equal(result.created.length, 2);
  assert.deepEqual(createdSources.map((item) => item.name), ["Spear", "Rune Amulet"]);
  assert.ok(createdSources.every((item) => item.flags?.[MODULE_ID]?.loot?.managed));
  assert.ok(!createdSources.some((item) => item.name === "Hoard Gem"));
  assert.ok(updates[0][`flags.${MODULE_ID}.loot`].salvage);
  assert.ok(updates[0][`flags.${MODULE_ID}.loot`].hoard);
  assert.equal(updates[0][`flags.${MODULE_ID}.loot`].materialized.hoard.actorId, "existing-loot");
});

test("deferred loot actor combines hoard items and generated salvage through Loot Forge", async () => {
  let received = null;
  const integrations = { lootApi: { createLootActorWithLoot: async (name, loot) => { received = { name, loot }; return { name, loot }; } } };
  const bp = blueprint("dragon", "brute", 12);
  bp.loot = {
    channels: {
      salvage: { result: { entries: [{ id: "scale", nameKey: "PF2E_CREATURE_FORGE.Loot.Salvage.DragonParts", fallbackName: "Dragon parts", quantity: 1, valueGp: 25 }] } },
      hoard: { result: { loot: { coins: { gp: 50 }, pf2eItems: [{ name: "Ruby", type: "treasure", system: {} }], generatedItems: [] } } }
    }
  };
  const actor = await new CreatureLootRuntime({ integrations }).createDeferredLootActor(bp);
  assert.equal(actor.name, "Loot Test · Loot");
  assert.equal(received.loot.coins.gp, 50);
  assert.equal(received.loot.pf2eItems.length, 2);
  assert.equal(received.loot.pf2eItems[1].type, "treasure");
});

test("scoped loot reroll preserves every other channel and locked channels keep their generated payload", async () => {
  const request = createGenerationRequest({
    identity: { category: "humanoid", role: "soldier", level: 8 },
    generation: { seed: "loot-locks" },
    loot: { mode: "required", equipment: { mode: "required" }, salvage: { mode: "required" }, hoard: { mode: "required" }, signature: { mode: "required" } }
  });
  const bp = blueprint("humanoid", "soldier", 8);
  bp.metadata.requestSnapshot = request;
  bp.loot = createLootPlan({ request, blueprint: bp, random: createRandom("loot-locks").fork("loot") });
  bp.loot.channels.equipment.locked = true;
  bp.loot.channels.equipment.result = { provider: "test", items: [{ name: "Locked Sword", type: "weapon", system: {} }] };
  bp.loot.channels.salvage.result = { provider: "test", entries: [{ id: "old", valueGp: 1 }], items: [] };

  const { CreatureGenerator } = await import("../scripts/core/generator.js");
  const { ContentRegistry } = await import("../scripts/core/registry.js");
  const generator = new CreatureGenerator({ registry: new ContentRegistry() });
  const rerolled = generator.reroll(bp, { scope: "loot:salvage", seed: "loot-locks-next" });
  assert.equal(rerolled.loot.channels.equipment.result.items[0].name, "Locked Sword");
  assert.deepEqual(rerolled.loot.channels.signature, bp.loot.channels.signature);

  let inventoryCalls = 0;
  const integration = new CreatureLootIntegration({ integrations: {
    lootApi: { generateInventoryForCreature: async () => { inventoryCalls += 1; return { combatGear: [{ name: "New Sword", type: "weapon", system: {} }] }; } },
    itemApi: { generate: async () => ({ itemSource: { name: "Signature", type: "weapon", system: {} } }) }
  } });
  const enriched = await integration.generateForBlueprint(rerolled, request);
  assert.equal(inventoryCalls, 0);
  assert.equal(enriched.loot.channels.equipment.result.items[0].name, "Locked Sword");
});


test("deferred loot summary separates salvage and hoard counts/value for NPC-sheet UX", () => {
  const bp = blueprint("dragon", "brute", 12);
  bp.loot = {
    channels: {
      salvage: { result: { entries: [
        { id: "scale", quantity: 2, valueGp: 7.5 },
        { id: "tooth", quantity: 1, valueGp: 5 }
      ] } },
      hoard: { result: { loot: { coins: { gp: 20 }, totalValueGp: 48, pf2eItems: [{ name: "Ruby" }], generatedItems: [{ name: "Scroll" }] } } }
    }
  };
  const summary = summarizeDeferredLoot(bp);
  assert.equal(summary.salvage.available, true);
  assert.equal(summary.salvage.itemCount, 3);
  assert.equal(summary.salvage.valueGp, 20);
  assert.equal(summary.hoard.available, true);
  assert.equal(summary.hoard.itemCount, 2);
  assert.equal(summary.hoard.valueGp, 48);
  assert.deepEqual(summary.combined, { itemCount: 5, valueGp: 68 });
});

test("creating deferred loot from an NPC records the created Loot Actor per materialized channel", async () => {
  const bp = blueprint("dragon", "brute", 12);
  bp.loot = {
    channels: {
      salvage: { result: { entries: [{ id: "scale", fallbackName: "Dragon scales", quantity: 1, valueGp: 10 }] } },
      hoard: { result: { loot: { coins: { gp: 50 }, totalValueGp: 50, pf2eItems: [{ name: "Ruby", type: "treasure", system: {} }], generatedItems: [] } } }
    }
  };
  let receivedName = null;
  const runtime = new CreatureLootRuntime({ integrations: { lootApi: {
    createLootActorWithLoot: async (name) => { receivedName = name; return { id: "loot-hoard", uuid: "Actor.loot-hoard", name }; }
  } } });
  const updates = [];
  const sourceActor = {
    id: "source",
    flags: { [MODULE_ID]: { blueprint: bp, loot: { summary: bp.loot.summary ?? {}, materialized: {} } } },
    async update(update) { updates.push(structuredClone(update)); return this; }
  };
  await runtime.createDeferredLootActor(sourceActor, { includeSalvage: false, includeHoard: true });
  assert.equal(receivedName, "Loot Test · Hoard");
  const lootFlag = updates[0][`flags.${MODULE_ID}.loot`];
  assert.equal(lootFlag.materialized.hoard.actorId, "loot-hoard");
  assert.equal(lootFlag.materialized.hoard.actorUuid, "Actor.loot-hoard");
  assert.deepEqual(lootFlag.materialized.hoard.channels, ["hoard"]);
  assert.equal(lootFlag.materialized.salvage, undefined);
});

test("public createActor enriches an unresolved loot plan before runtime materialization", async () => {
  const previousGame = globalThis.game;
  const previousActor = globalThis.Actor;
  const creatureModule = { id: MODULE_ID, active: true, version: "0.7.0", api: null };
  let lootCalls = 0;
  const lootModule = {
    id: "pf2e-loot-forge", active: true, version: "test",
    api: {
      generateInventoryForCreature: async () => { lootCalls += 1; return { combatGear: [{ name: "API Spear", type: "weapon", system: {} }] }; }
    }
  };
  globalThis.game = {
    modules: new Map([[MODULE_ID, creatureModule], ["pf2e-loot-forge", lootModule]]),
    items: [], folders: [], packs: [],
    i18n: { lang: "en", localize: (key) => key },
    settings: { get: () => ({}), set: async () => {} }
  };
  const embedded = [];
  globalThis.Actor = {
    create: async (source) => ({
      id: "loot-api", uuid: "Actor.loot-api", name: source.name, flags: structuredClone(source.flags), items: [],
      async deleteEmbeddedDocuments() { return []; },
      async createEmbeddedDocuments(_type, sources) { embedded.push(...structuredClone(sources)); return sources; },
      async update(update) { this.lastUpdate = structuredClone(update); return this; },
      sheet: { render: () => {} }
    })
  };
  try {
    const { initializePublicApi } = await import("../scripts/api/public-api.js");
    const api = initializePublicApi();
    const bp = blueprint("humanoid", "soldier", 5);
    bp.loot = {
      schemaVersion: 2, policy: "required", generated: false, environment: "generic", treasureProfile: "standard", useItemForge: true,
      channels: {
        equipment: { mode: "required", selected: true, chance: 1, reason: "required", result: null },
        signature: { mode: "none", selected: false, chance: 0, reason: "disabled", result: null },
        salvage: { mode: "none", selected: false, chance: 0, reason: "disabled", result: null },
        hoard: { mode: "none", selected: false, chance: 0, reason: "disabled", result: null }
      }, diagnostics: [], summary: { selectedChannels: ["equipment"], generatedChannels: [], carriedItemCount: 0, deferredItemCount: 0, totalValueGp: 0 }
    };
    bp.metadata.requestSnapshot = createGenerationRequest({ identity: { category: "humanoid", role: "soldier", level: 5 }, loot: { equipment: { mode: "required" }, signature: { mode: "none" }, salvage: { mode: "none" }, hoard: { mode: "none" } } });
    const result = await api.createActor(bp, { renderSheet: false, materializeEffects: false, materializeSpecialFeatures: false, materializeSpellcasting: false });
    assert.equal(lootCalls, 1);
    assert.equal(embedded[0].name, "API Spear");
    assert.equal(result.runtime.creatureForge.runtimeStatus.loot, "ready");
  } finally {
    globalThis.game = previousGame;
    globalThis.Actor = previousActor;
  }
});

test("deferred salvage uses PF2E treasure-compatible source shape and hoard copies are sanitized", async () => {
  let received = null;
  const integrations = { lootApi: {
    createLootActorWithLoot: async (name, loot) => { received = { name, loot }; return { id: "loot", name }; }
  } };
  const bp = blueprint("dragon", "brute", 12);
  bp.loot = {
    channels: {
      salvage: { result: { entries: [{ id: "scale", fallbackName: "Dragon scales", quantity: 2, valueGp: 7.5 }] } },
      hoard: { result: { loot: {
        coins: { gp: 10 },
        pf2eItems: [{ _id: "compendium-id", name: "Ruby", type: "treasure", system: { description: { value: "" }, price: { value: { gp: 10 } }, quantity: 1, bulk: { value: 0 }, stackGroup: "" } }],
        generatedItems: []
      } } }
    }
  };

  await new CreatureLootRuntime({ integrations }).createDeferredLootActor(bp);
  assert.equal(received.loot.pf2eItems.length, 2);
  assert.equal(received.loot.pf2eItems[0]._id, undefined);
  const copied = received.loot.pf2eItems[0];
  assert.equal(copied._id, undefined);
  assert.equal(copied.system.stackGroup, undefined);
  assert.equal(copied.system.category, null);
  assert.deepEqual(copied.system.price.value, { gp: 10 });

  const salvage = received.loot.pf2eItems[1];
  assert.equal(salvage.type, "treasure");
  assert.equal(salvage.system.stackGroup, undefined);
  assert.equal(salvage.system.category, null);
  assert.equal(salvage.system.level.value, 0);
  assert.equal(salvage.system.size, "med");
  assert.deepEqual(salvage.system.traits, { value: [], rarity: "common", otherTags: [] });
  assert.deepEqual(salvage.system.bulk, { value: 0 });
  assert.deepEqual(salvage.system.price.value, { gp: 7, sp: 5 });
  assert.equal(salvage.system.quantity, 2);
});

test("deferred loot uses the PF2E-native writer instead of Loot Forge's legacy item writer and cleans up on failure", async () => {
  const previousActor = globalThis.Actor;
  let deleted = false;
  let addLootCalled = false;
  let oneShotCalled = false;
  const created = {
    id: "partial-loot",
    name: "Partial",
    system: { currency: {} },
    async update() { return this; },
    async createEmbeddedDocuments() { throw new Error("strict PF2E item validation"); },
    async delete() { deleted = true; }
  };
  globalThis.Actor = { create: async () => created };
  const bp = blueprint("dragon", "brute", 12);
  bp.loot = { channels: { salvage: { result: { entries: [{ id: "scale", fallbackName: "Scales", quantity: 1, valueGp: 1 }] } }, hoard: { result: null } } };
  const runtime = new CreatureLootRuntime({ integrations: { lootApi: {
    addLootToActor: async () => { addLootCalled = true; },
    createLootActorWithLoot: async () => { oneShotCalled = true; }
  } } });
  try {
    await assert.rejects(() => runtime.createDeferredLootActor(bp, { includeHoard: false }), /strict PF2E item validation/);
    assert.equal(addLootCalled, false);
    assert.equal(oneShotCalled, false);
    assert.equal(deleted, true);
  } finally {
    globalThis.Actor = previousActor;
  }
});

test("successful deferred Loot Actor creation survives provenance persistence failure", async () => {
  const bp = blueprint("dragon", "brute", 12);
  bp.loot = { channels: { salvage: { result: null }, hoard: { result: { loot: { coins: { gp: 5 }, pf2eItems: [], generatedItems: [], totalValueGp: 5 } } } } };
  const sourceActor = {
    flags: { [MODULE_ID]: { blueprint: bp, loot: { materialized: {} } } },
    async setFlag() { throw new Error("flag write denied"); }
  };
  const created = { id: "loot-ok", uuid: "Actor.loot-ok", name: "Loot OK" };
  const runtime = new CreatureLootRuntime({ integrations: { lootApi: {
    createLootActorWithLoot: async () => created
  } } });
  const result = await runtime.createDeferredLootActor(sourceActor, { includeSalvage: false, includeHoard: true });
  assert.equal(result, created);
});
