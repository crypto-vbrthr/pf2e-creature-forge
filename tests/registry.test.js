import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";

test("content bundles register namespaced content with provenance", () => {
  const registry = new ContentRegistry();
  const result = registry.registerBundle({
    id: "test.bundle",
    moduleId: "test-module",
    version: "1.2.3",
    content: {
      subtypes: [{ id: "test.abyssal", slug: "abyssal" }],
      abilities: [{ id: "test.grasp", selection: { subtypes: ["abyssal"] } }]
    }
  });
  assert.equal(result.registered.length, 2);
  assert.equal(registry.get("subtype", "test.abyssal").source.bundleId, "test.bundle");
  assert.equal(registry.get("ability", "test.grasp").source.version, "1.2.3");
});

test("content query filters by category, subtype, role, and level", () => {
  const registry = new ContentRegistry();
  registry.register("ability", {
    id: "test.shadow-step",
    selection: { categories: ["undead"], anySubtypes: ["incorporeal"], roles: ["skirmisher"], minimumLevel: 5 }
  });
  assert.equal(registry.query("ability", { category: "undead", subtypes: ["incorporeal"], role: "skirmisher", level: 7 }).length, 1);
  assert.equal(registry.query("ability", { category: "undead", subtypes: ["incorporeal"], role: "skirmisher", level: 3 }).length, 0);
});

test("unregisterBundle removes all bundle content", () => {
  const registry = new ContentRegistry();
  registry.registerBundle({
    id: "test.bundle",
    content: { auras: [{ id: "test.aura" }], effects: [{ id: "test.effect" }] }
  });
  assert.equal(registry.unregisterBundle("test.bundle"), 2);
  assert.equal(registry.list("aura").length, 0);
  assert.equal(registry.list("effect").length, 0);
});

test("duplicate content is rejected unless replace is explicit", () => {
  const registry = new ContentRegistry();
  registry.register("ability", { id: "test.one", name: "One" });
  assert.throws(() => registry.register("ability", { id: "test.one", name: "Two" }), /already registered/);
  registry.register("ability", { id: "test.one", name: "Two" }, { replace: true });
  assert.equal(registry.get("ability", "test.one").name, "Two");
});

test("compendium-discovered content is source-filtered while core/external content remains visible", () => {
  const registry = new ContentRegistry();
  registry.register("subtype", { id: "core.fire", slug: "fire", source: { moduleId: "core" } });
  registry.register("subtype", {
    id: "discovery.aquatic",
    slug: "aquatic",
    source: { moduleId: "pf2e-creature-forge", sourceKind: "compendium", compendiumId: "test.bestiary" }
  });

  assert.equal(registry.resolve("subtype", "fire", { compendiumIds: [] })?.slug, "fire");
  assert.equal(registry.resolve("subtype", "aquatic", { compendiumIds: [] }), null);
  assert.equal(registry.resolve("subtype", "aquatic", { compendiumIds: ["test.bestiary"] })?.slug, "aquatic");
  assert.equal(registry.listResolved("subtype", { compendiumIds: [] }).some((entry) => entry.slug === "aquatic"), false);
  assert.equal(registry.listResolved("subtype", { compendiumIds: ["test.bestiary"] }).some((entry) => entry.slug === "aquatic"), true);
});
