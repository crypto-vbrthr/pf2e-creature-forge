import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import { validateBlueprint } from "../scripts/core/validator.js";
import { CreatureEffectRuntime } from "../scripts/runtime/effect-runtime.js";
import { buildAfflictionHostDescription } from "../scripts/core/compiler.js";

function setupGenerator() {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  return new CreatureGenerator({ registry });
}

test("effect refresh preserves a verified Affliction host block on an effect-backed ability", async () => {
  const blueprint = {
    abilities: [{
      id: "ability-1",
      contentId: "test.hybrid",
      name: "Hybrid Ability",
      description: "Base ability text.",
      type: "action",
      actionCost: 2,
      category: "offensive",
      traits: [],
      applications: [{ type: "effect", ref: "effect-1", target: "target", timing: "on-hit" }]
    }],
    resources: {
      effects: [{ id: "effect-1", contentId: "effect-1", definition: { name: "Effect One", components: [{ type: "condition", slug: "frightened", value: 1 }] } }]
    }
  };
  const afflictionBlock = buildAfflictionHostDescription("<p>old base</p>", [{
    binding: {
      afflictionRef: "affliction-1",
      templateUuid: "Actor.test.Item.affliction-template",
      delivery: { trigger: "on-hit", application: "automatic" }
    },
    resource: { id: "affliction-1", name: "Test Venom", definition: { name: "Test Venom" } }
  }]);
  const item = {
    id: "ability-item",
    flags: { "pf2e-creature-forge": { abilityId: "ability-1" } },
    system: { description: { value: afflictionBlock } }
  };
  const updates = [];
  const actor = {
    id: "actor-1",
    uuid: "Actor.actor-1",
    items: [item],
    async updateEmbeddedDocuments(_type, values) { updates.push(...values); return values; }
  };
  const runtime = new CreatureEffectRuntime({ integrations: { effectApi: { effects: { apply: async () => [] } } } });
  await runtime.updateAbilityDescriptions(actor, blueprint, { resources: { "effect-1": { primaryUuid: "Item.effect-one" } } });
  const description = updates[0]["system.description.value"];
  assert.match(description, /pf2e-creature-forge:host-afflictions:start/);
  assert.match(description, /Test Venom/);
  assert.match(description, /@UUID\[Item\.effect-one\]/);
  assert.match(description, /Base ability text\./);
});

test("area effect target mode resolves all selected Foundry targets", () => {
  const previousGame = globalThis.game;
  const first = { id: "one", actor: { id: "a1" } };
  const second = { id: "two", actor: { id: "a2" } };
  globalThis.game = { user: { targets: new Set([first, second]) } };
  try {
    const runtime = new CreatureEffectRuntime({ integrations: {} });
    assert.deepEqual(runtime.resolveTargets({ id: "source" }, "area"), [first, second]);
  } finally {
    globalThis.game = previousGame;
  }
});

test("blueprint validation rejects area geometry and effect target modes the runtime cannot execute safely", () => {
  const generator = setupGenerator();
  const blueprint = generator.generate({
    identity: { name: "Audit Dragon", level: 8, role: "brute", category: "dragon", subtypes: ["fire"] },
    abilities: { mode: "auto", count: 2, powerBudget: "auto" },
    specialFeatures: { auras: { mode: "none" }, afflictions: { mode: "none" } },
    spellcasting: { mode: "none" },
    generation: { seed: "d1" }
  });
  const signature = blueprint.abilities.find((ability) => ability.signature?.kind === "dragon-breath");
  assert.ok(signature);
  signature.mechanics.area.shape = "sphere";
  signature.applications[0].target = "everyone-in-scene";
  const validation = validateBlueprint(blueprint);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((entry) => entry.code === "INVALID_ABILITY_AREA_SHAPE"));
  assert.ok(validation.errors.some((entry) => entry.code === "INVALID_EFFECT_TARGET_MODE"));
});
