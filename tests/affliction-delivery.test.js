import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import { resolveAfflictionDelivery } from "../scripts/core/affliction-delivery.js";
import { CreatureSpecialFeatureRuntime } from "../scripts/runtime/special-feature-runtime.js";

function setup() { const registry = new ContentRegistry(); registerCoreContent(registry); return { registry, generator: new CreatureGenerator({ registry }) }; }

test("intrinsic predator venom binds to a generated attack without injury-poison charge semantics", () => {
  const { generator } = setup();
  const bp = generator.generate({
    identity: { level: 5, role: "skirmisher", category: "animal", subtypes: ["poison"] },
    options: { attackCount: 2 }, abilities: { mode: "off", powerBudget: 6 },
    specialFeatures: { auras: { mode: "none" }, afflictions: { mode: "required" } }, generation: { seed: "delivery-venom" }
  });
  const aff = bp.resources.afflictions[0];
  assert.equal(aff.contentId, "pf2e-creature-forge.affliction.predator-venom");
  assert.equal(aff.definition.delivery.injuryPoison, false);
  assert.equal(aff.delivery.mode, "hosted");
  assert.equal(aff.delivery.hostType, "attack");
  assert.equal(aff.delivery.trigger, "on-damage");
  assert.equal(aff.delivery.application, "automatic");
  assert.ok(bp.combat.attacks.some((attack) => attack.id === aff.delivery.hostId));
});

test("curse delivery prefers a thematically matching ability over an attack", () => {
  const resource = { definition: { afflictionType: "curse", delivery: { injuryPoison: false } }, deliveryProfile: { hostOrder: ["ability", "attack"], preferredAbilityTags: ["unholy"], trigger: "on-use", application: "prompt" } };
  const bp = { combat: { attacks: [{ id: "attack-1", kind: "melee", name: "Claw", damage: { type: "slashing" }, traits: [] }] }, abilities: [{ id: "ability-1", type: "action", tags: ["unholy", "control"], traits: [] }] };
  const delivery = resolveAfflictionDelivery(resource, bp);
  assert.equal(delivery.hostType, "ability");
  assert.equal(delivery.hostId, "ability-1");
  assert.equal(delivery.trigger, "on-use");
});

test("runtime creates actor-local Affliction template and attaches an Affliction Forge reference to the selected host", async () => {
  const bp = {
    resources: { auras: [], afflictions: [{ id: "test.aff", name: "Venom", definition: { id: "test.aff", name: "Venom", afflictionType: "poison", stages: [{ number: 1, name: "Stage 1" }] }, delivery: { mode: "hosted", hostType: "attack", hostId: "attack-1", trigger: "on-damage", application: "automatic", injuryPoison: false } }] }
  };
  const attack = { id: "item-attack", uuid: "Actor.a.Item.item-attack", name: "Bite", flags: { "pf2e-creature-forge": { attackId: "attack-1" } }, system: { description: { value: "" } } };
  const affItem = { id: "item-aff", flags: { "pf2e-creature-forge": { afflictionRef: "test.aff" } }, system: { description: { value: "" } } };
  const actor = {
    id: "a", uuid: "Actor.a", flags: { "pf2e-creature-forge": { blueprint: bp } }, items: [attack, affItem],
    async createEmbeddedDocuments(_t, sources) { const made = sources.map((source, i) => ({ ...source, id: `template-${i}`, uuid: `Actor.a.Item.template-${i}` })); this.items.push(...made); return made; },
    async deleteEmbeddedDocuments(_t, ids) { this.items = this.items.filter((item) => !ids.includes(item.id)); return ids; },
    async updateEmbeddedDocuments(_t, updates) { for (const update of updates) { const item=this.items.find((x)=>x.id===update._id); if (item && update["system.description.value"] !== undefined) item.system.description.value=update["system.description.value"]; } return updates; }
  };
  const refs = new Map();
  const afflictionApi = {
    definitions: { validate: () => ({ valid: true, errors: [] }) },
    documents: { buildTemplateSource: (definition) => ({ name: definition.name, type: "effect", system: { description: { value: "" }, tokenIcon: { show: true } }, flags: { "pf2e-affliction-forge": { managed: true, documentKind: "affliction-template", originModule: "pf2e-creature-forge" } } }) },
    references: {
      list: (item) => refs.get(item.id) ?? [], set: async (item, value) => refs.set(item.id, value),
      create: (value) => ({ ...value, schemaVersion: 1 }), add: async (item, reference) => { refs.set(item.id, [...(refs.get(item.id) ?? []), reference]); return reference; }
    },
    engine: { applyDefinition: async () => ({}) }
  };
  const runtime = new CreatureSpecialFeatureRuntime({ integrations: { afflictionApi } });
  const result = await runtime.materializeAfflictions(actor, bp);
  assert.equal(result.templates.length, 1);
  assert.equal(result.bindings[0].hostItemId, "item-attack");
  assert.equal(refs.get("item-attack")[0].trigger, "on-damage");
  assert.equal(refs.get("item-attack")[0].application, "automatic");
  assert.equal(refs.get("item-attack")[0].metadata.originModule, "pf2e-creature-forge");
  assert.match(attack.system.description.value, /Transmits affliction|Überträgt Leiden/);
});

test("generated Affliction delivery descriptions localize runtime metadata in German even when Foundry returns raw keys", async () => {
  const previous = globalThis.game;
  globalThis.game = { i18n: { lang: "de", localize: (key) => key } };
  try {
    const { buildAfflictionDescription, buildAfflictionHostDescription } = await import("../scripts/core/compiler.js");
    const resource = {
      id: "test.venom",
      definition: { name: "Riffstachelgift", afflictionType: "poison", description: "Testbeschreibung", stages: [{ number: 1, name: "Phase 1" }] }
    };
    const binding = {
      afflictionRef: "test.venom",
      mode: "hosted",
      status: "verified",
      verified: true,
      templateUuid: "Compendium.test.affliction.Item.venom",
      hostItemUuid: "Actor.a.Item.attack",
      hostName: "Krallen",
      delivery: { trigger: "on-damage", application: "automatic" }
    };
    const host = buildAfflictionHostDescription("", [{ binding, resource }]);
    const affliction = buildAfflictionDescription(resource, { actorUuid: "Actor.a", runtimeAvailable: true, binding });
    assert.match(host, /Überträgt Leiden/);
    assert.match(host, /Bei verursachtem Schaden/);
    assert.match(host, /Automatisch/);
    assert.doesNotMatch(host, /Transmits affliction|on-damage|automatic/);
    assert.match(affliction, /Übertragung/);
    assert.match(affliction, /Bei verursachtem Schaden/);
    assert.match(affliction, /Automatisch/);
    assert.match(affliction, /Verknüpft/);
    assert.doesNotMatch(affliction, /Delivery|on-damage|automatic/);
  } finally {
    globalThis.game = previous;
  }
});
