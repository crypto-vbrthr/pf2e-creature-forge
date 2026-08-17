import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import {
  AfflictionForgeLibraryBridge,
  afflictionForgeBridgeLibraryId,
  definitionFingerprint
} from "../scripts/integration/affliction-library-bridge.js";
import { CreatureSpecialFeatureRuntime } from "../scripts/runtime/special-feature-runtime.js";

function forgeDefinition() {
  return {
    schemaVersion: 2,
    id: "venoms.test-serpent-venom",
    name: "Test Serpent Venom",
    description: "A library venom.",
    afflictionType: "poison",
    level: 5,
    rarity: "common",
    traits: ["poison"],
    themes: ["venom"],
    delivery: { injuryPoison: false },
    checks: [{ id: "primary", save: "fortitude", dcMode: "fixed", dc: 22 }],
    stages: [{ number: 1, name: "Stage 1", duration: { value: 1, unit: "rounds" } }]
  };
}

function bridgeFixture() {
  const definition = forgeDefinition();
  const descriptor = {
    uuid: "Compendium.pf2e-affliction-venoms.afflictions.Item.serpent",
    id: "serpent",
    name: definition.name,
    definitionId: definition.id,
    definitionVersion: 3,
    afflictionType: "poison",
    level: 5,
    traits: ["poison"],
    themes: ["venom"],
    libraryId: "venoms-and-toxins"
  };
  const libraries = [
    { id: "venoms-and-toxins", label: "Venoms & Toxins", moduleId: "pf2e-affliction-venoms", version: "1.0.0", kind: "provider", providerId: "venoms", enabled: true, available: true },
    { id: "compendium:pf2e.random-items", label: "Random Items", moduleId: "pf2e", kind: "compendium", enabled: true, available: true }
  ];
  const afflictionApi = {
    libraries: {
      list: () => libraries,
      templates: async ({ libraryIds }) => libraryIds?.includes("venoms-and-toxins") ? [descriptor] : []
    },
    templates: { read: async (uuid) => { assert.equal(uuid, descriptor.uuid); return structuredClone(definition); } }
  };
  return { definition, descriptor, libraries, afflictionApi };
}

test("Affliction Forge provider libraries bridge into Creature Forge and keep canonical template provenance", async () => {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  const fixture = bridgeFixture();
  const bridge = new AfflictionForgeLibraryBridge({ registry, integrations: { afflictionApi: fixture.afflictionApi } });

  await bridge.refreshLibraries();
  const providerId = afflictionForgeBridgeLibraryId("venoms-and-toxins");
  const implicitId = afflictionForgeBridgeLibraryId("compendium:pf2e.random-items");
  assert.equal(registry.getAfflictionLibrary(providerId).defaultEnabled, true);
  assert.equal(registry.getAfflictionLibrary(implicitId).defaultEnabled, false, "implicit Item compendia should not all become default Creature Forge sources");

  const prepared = await bridge.ensure({ afflictions: [providerId] });
  assert.equal(prepared.prepared[0].count, 1);
  const entries = registry.list("affliction", { libraryId: providerId });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].source.templateUuid, fixture.descriptor.uuid);
  assert.equal(entries[0].source.sourceKind, "affliction-forge-library");
  assert.equal(entries[0].preserveDefinitionScale, true);

  const generator = new CreatureGenerator({ registry });
  const bp = generator.generate({
    identity: { level: 5, role: "skirmisher", category: "animal", subtypes: ["poison"] },
    sources: { afflictions: [providerId] },
    abilities: { mode: "off", powerBudget: 6 },
    specialFeatures: { auras: { mode: "none" }, afflictions: { mode: "required" } },
    generation: { seed: "affliction-library-bridge" }
  });
  const resource = bp.resources.afflictions[0];
  assert.equal(resource.templateUuid, fixture.descriptor.uuid);
  assert.equal(resource.definition.level, 5);
  assert.equal(resource.definition.checks[0].dc, 22, "canonical Affliction Forge DC must not be rescaled by Creature Forge");
});

test("runtime uses canonical Affliction Forge template UUID and can recover an attack host by blueprint order", async () => {
  const definition = forgeDefinition();
  const templateUuid = "Compendium.pf2e-affliction-venoms.afflictions.Item.serpent";
  const resource = {
    id: "cf.library-venom",
    templateUuid,
    definition,
    source: { sourceKind: "affliction-forge-library", templateUuid, definitionFingerprint: definitionFingerprint(definition), detached: false },
    delivery: { mode: "hosted", hostType: "attack", hostId: "attack-1", trigger: "on-damage", application: "automatic", injuryPoison: false }
  };
  const bp = { combat: { attacks: [{ id: "attack-1" }] }, abilities: [], resources: { auras: [], afflictions: [resource] } };
  const attack = { id: "melee-1", uuid: "Actor.a.Item.melee-1", type: "melee", name: "Bite", flags: {}, system: { description: { value: "" } } };
  const affItem = { id: "aff-1", type: "action", flags: { "pf2e-creature-forge": { afflictionRef: resource.id } }, system: { description: { value: "" } } };
  const refs = new Map();
  const actor = {
    id: "a", uuid: "Actor.a", flags: { "pf2e-creature-forge": { blueprint: bp } }, items: [attack, affItem],
    async createEmbeddedDocuments() { throw new Error("canonical library templates must not be copied to the actor"); },
    async updateEmbeddedDocuments(_t, updates) { for (const update of updates) { const item=this.items.find((x)=>x.id===update._id); if (item && update["system.description.value"] !== undefined) item.system.description.value=update["system.description.value"]; } return updates; }
  };
  const applyCalls = [];
  const afflictionApi = {
    definitions: { validate: () => ({ valid: true, errors: [] }) },
    documents: { buildTemplateSource: () => { throw new Error("not expected"); } },
    references: {
      isHostItem: (item) => item.type === "melee",
      list: (item) => refs.get(item.id) ?? [],
      get: (item, id) => (refs.get(item.id) ?? []).find((entry) => entry.id === id) ?? null,
      set: async (item, value) => refs.set(item.id, value),
      create: (value) => ({ ...value, schemaVersion: 1 }),
      add: async (item, reference) => { refs.set(item.id, [...(refs.get(item.id) ?? []), reference]); return reference; }
    },
    engine: {
      applyDefinition: async () => { throw new Error("canonical source should use applyTemplate"); },
      applyTemplate: async (uuid, targets) => { applyCalls.push({ uuid, targets }); return { ok: true }; }
    }
  };
  const runtime = new CreatureSpecialFeatureRuntime({ integrations: { afflictionApi } });
  const result = await runtime.materializeAfflictions(actor, bp);
  assert.equal(result.templates[0].kind, "library");
  assert.equal(result.templates[0].uuid, templateUuid);
  assert.equal(result.bindings[0].status, "verified");
  assert.equal(result.bindings[0].hostItemId, "melee-1");
  assert.equal(refs.get("melee-1")[0].templateUuid, templateUuid);
  assert.match(attack.system.description.value, /Transmits affliction|Überträgt Leiden/);

  await runtime.applyAffliction({ actor, afflictionRef: resource.id, targets: [{ id: "target" }] });
  assert.equal(applyCalls[0].uuid, templateUuid);
});

test("runtime fails closed to manual application when a host reference cannot be read back", async () => {
  const definition = forgeDefinition();
  const resource = {
    id: "cf.unverified",
    definition,
    delivery: { mode: "hosted", hostType: "attack", hostId: "attack-1", trigger: "on-hit", application: "automatic" }
  };
  const bp = { combat: { attacks: [{ id: "attack-1" }] }, abilities: [], resources: { auras: [], afflictions: [resource] } };
  const attack = { id: "melee-1", uuid: "Actor.a.Item.melee-1", type: "melee", name: "Bite", flags: { "pf2e-creature-forge": { attackId: "attack-1" } }, system: { description: { value: "" } } };
  const actor = {
    uuid: "Actor.a", flags: { "pf2e-creature-forge": { blueprint: bp } }, items: [attack],
    async createEmbeddedDocuments(_t, sources) { const made = [{ ...sources[0], id: "template-1", uuid: "Actor.a.Item.template-1" }]; this.items.push(...made); return made; },
    async updateEmbeddedDocuments() { return []; }
  };
  const afflictionApi = {
    definitions: { validate: () => ({ valid: true, errors: [] }) },
    documents: { buildTemplateSource: (def) => ({ name: def.name, type: "effect", system: { tokenIcon: { show: true } }, flags: {} }) },
    references: {
      isHostItem: () => true,
      list: () => [], get: () => null, set: async () => [],
      create: (value) => ({ ...value, schemaVersion: 1 }), add: async (_item, reference) => reference
    },
    engine: { applyDefinition: async () => ({}) }
  };
  const runtime = new CreatureSpecialFeatureRuntime({ integrations: { afflictionApi } });
  const result = await runtime.materializeAfflictions(actor, bp);
  assert.equal(result.bindings[0].mode, "manual");
  assert.equal(result.bindings[0].status, "reference-not-persisted");
  assert.equal(result.warnings[0].code, "AFFLICTION_REFERENCE_NOT_PERSISTED");
});
