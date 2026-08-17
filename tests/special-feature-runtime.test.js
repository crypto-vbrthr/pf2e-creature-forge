import test from "node:test";
import assert from "node:assert/strict";
import { CreatureSpecialFeatureRuntime } from "../scripts/runtime/special-feature-runtime.js";

function blueprint() {
  return {
    resources: {
      auras: [{
        id: "test.aura",
        nameKey: "TEST.Aura.Name",
        definition: { id: "test.aura", name: "Test Aura", description: "", metadata: { createdBy: "pf2e-creature-forge" } }
      }],
      afflictions: [{
        id: "test.affliction",
        nameKey: "TEST.Affliction.Name",
        definition: { id: "test.affliction", name: "Test Affliction", description: "", afflictionType: "disease", stages: [{ number: 1, name: "Stage 1" }] }
      }]
    }
  };
}

function actor(bp = blueprint()) {
  return {
    id: "actor-1",
    uuid: "Actor.actor-1",
    flags: { "pf2e-creature-forge": { blueprint: bp } },
    items: [{ id: "affliction-item", flags: { "pf2e-creature-forge": { afflictionRef: "test.affliction" } } }],
    async updateEmbeddedDocuments(_type, updates) { this.updates = updates; return updates; }
  };
}

test("special-feature runtime assigns actor-local aura definitions and updates affliction controls", async () => {
  const assigned = [];
  const runtime = new CreatureSpecialFeatureRuntime({
    integrations: {
      auraApi: {
        instances: {
          list: () => [],
          assignDefinition: async (_actor, definition) => { assigned.push(definition); return { id: "aura-instance-1" }; }
        }
      },
      afflictionApi: { engine: { applyDefinition: async () => ({}) } }
    }
  });
  const source = actor();
  const result = await runtime.initializeActor(source);
  assert.equal(result.auras.assigned[0].instanceId, "aura-instance-1");
  assert.equal(assigned[0].id, "test.aura");
  assert.match(source.updates[0]["system.description.value"], /pf2e-creature-forge-apply-affliction/);
  assert.match(source.updates[0]["system.description.value"], /data-cf-actor-uuid="Actor\.actor-1"/);
});

test("manual affliction runtime delegates to Affliction Forge for selected targets", async () => {
  const previousGame = globalThis.game;
  const target = { id: "target", actor: { id: "target-actor" } };
  const calls = [];
  globalThis.game = { user: { targets: new Set([target]) }, i18n: { lang: "en", localize: (key) => key } };
  try {
    const runtime = new CreatureSpecialFeatureRuntime({
      integrations: {
        afflictionApi: {
          engine: {
            applyDefinition: async (definition, targets, options) => { calls.push({ definition, targets, options }); return { ok: true }; }
          }
        }
      }
    });
    const source = actor();
    const result = await runtime.applyAffliction({ actor: source, afflictionRef: "test.affliction" });
    assert.deepEqual(result.targets, [target]);
    assert.equal(calls[0].definition.id, "test.affliction");
    assert.equal(calls[0].definition.stages[0].name, "Stage 1");
    assert.equal(calls[0].options.sourceActorUuid, "Actor.actor-1");
  } finally {
    globalThis.game = previousGame;
  }
});
