import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { CompendiumDiscoveryManager, scanCreatureCompendium } from "../scripts/core/compendium-discovery.js";

function makePack(id, entries) {
  return {
    collection: id,
    documentName: "Actor",
    metadata: { label: `Pack ${id}`, packageName: "test-module", packageType: "module" },
    locked: true,
    async getIndex({ fields }) {
      assert.deepEqual(fields, ["type", "system.traits.value"]);
      return entries;
    }
  };
}

test("NPC compendium discovery derives creature categories and trait-based subtype candidates", async () => {
  const registry = new ContentRegistry();
  registry.register("category", { id: "core.animal", slug: "animal", trait: "animal" });
  registry.register("category", { id: "core.undead", slug: "undead", trait: "undead" });
  const pack = makePack("test.bestiary", [
    { type: "npc", system: { traits: { value: ["animal", "aquatic"] } } },
    { type: "npc", system: { traits: { value: ["animal", "aquatic", "amphibious"] } } },
    { type: "npc", system: { traits: { value: ["undead", "incorporeal"] } } },
    { type: "character", system: { traits: { value: ["human"] } } }
  ]);

  const result = await scanCreatureCompendium(pack, { registry });
  assert.equal(result.actorCount, 3);
  assert.equal(result.categories.find((entry) => entry.slug === "animal")?.discovery.count, 2);
  assert.equal(result.categories.find((entry) => entry.slug === "undead")?.discovery.count, 1);
  const aquatic = result.subtypes.find((entry) => entry.slug === "aquatic");
  assert.equal(aquatic.discovery.count, 2);
  assert.deepEqual(aquatic.supports.categories, ["animal"]);
  assert.equal(aquatic.source.compendiumId, "test.bestiary");
});

test("discovery manager caches packs and exposes discovered content only for selected sources", async () => {
  const registry = new ContentRegistry();
  registry.register("category", { id: "core.animal", slug: "animal", trait: "animal" });
  registry.register("subtype", { id: "core.fire", slug: "fire", trait: "fire" });
  const pack = makePack("test.bestiary", [
    { type: "npc", system: { traits: { value: ["animal", "aquatic"] } } }
  ]);

  const previousGame = globalThis.game;
  globalThis.game = { packs: new Map([[pack.collection, pack]]) };
  try {
    const manager = new CompendiumDiscoveryManager({ registry });
    await manager.ensure({ subtypes: ["test.bestiary"] });
    assert.equal(manager.isPrepared({ subtypes: ["test.bestiary"] }), true);
    assert.equal(manager.listContent("subtype", { selectedSources: [] }).some((entry) => entry.slug === "aquatic"), false);
    assert.equal(manager.listContent("subtype", { selectedSources: ["test.bestiary"] }).some((entry) => entry.slug === "aquatic"), true);
    assert.equal(manager.listContent("subtype", { selectedSources: [] }).some((entry) => entry.slug === "fire"), true);
  } finally {
    globalThis.game = previousGame;
  }
});
