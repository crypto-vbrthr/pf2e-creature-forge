import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import { SeededRandom } from "../scripts/core/rng.js";
import { limitedAreaDamageFormula, resolveDragonBreathProfile, resolveSignaturePlan } from "../scripts/core/signature-powers.js";
import { compileActorSource } from "../scripts/core/compiler.js";
import { CORE_ABILITIES } from "../scripts/core/core-abilities.js";

function setup() {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  return { registry, generator: new CreatureGenerator({ registry }) };
}

test("limited-use area damage follows the GM Core breath-weapon progression", () => {
  assert.equal(limitedAreaDamageFormula(-1), "1d6");
  assert.equal(limitedAreaDamageFormula(0), "1d10");
  assert.equal(limitedAreaDamageFormula(8), "9d6");
  assert.equal(limitedAreaDamageFormula(24), "25d6");
});

test("dragon breath resolves generic elemental affinities into damage, saves, and shapes", () => {
  assert.deepEqual(resolveDragonBreathProfile(["fire"]), { affinity: "fire", damageType: "fire", save: "reflex", shapes: ["cone", "line"], trait: "fire" });
  assert.equal(resolveDragonBreathProfile(["poison"]).save, "fortitude");
  assert.equal(resolveDragonBreathProfile(["air"]).damageType, "electricity");
  assert.equal(resolveDragonBreathProfile(["water"]).damageType, "cold");
  assert.equal(resolveDragonBreathProfile([]), null);
});

test("forced dragon signature plan creates a dynamic Effect Forge damage resource", () => {
  const { registry } = setup();
  const request = {
    identity: { category: "dragon", subtypes: ["fire"] },
    abilities: { mode: "auto", count: 2, complexity: "standard", powerBudget: "auto", focus: [] },
    sources: { abilities: [] },
    generation: { variation: "balanced" }
  };
  const result = resolveSignaturePlan({ request, registry, level: 8, roleId: "brute", category: "dragon", subtypes: ["fire"], random: new SeededRandom("breath-plan"), force: true });
  assert.ok(result.ability);
  assert.equal(result.ability.signature.kind, "dragon-breath");
  assert.equal(result.ability.mechanics.damage.formula, "9d6");
  assert.equal(result.ability.mechanics.damage.type, "fire");
  assert.equal(result.ability.mechanics.save.type, "reflex");
  assert.equal(result.ability.mechanics.save.basic, true);
  assert.equal(result.ability.generatedEffects.length, 1);
  assert.deepEqual(result.ability.generatedEffects[0].definition.components, [{ type: "damage", formula: "9d6", damageType: "fire" }]);
  assert.equal(result.ability.applications[0].ref, result.ability.generatedEffects[0].id);
  assert.equal(result.bonus, 3);
});

test("elemental dragons can receive a breath weapon during normal generation without starving ordinary abilities", () => {
  const { generator } = setup();
  const blueprint = generator.generate({
    identity: { name: "Ember Drake", level: 8, role: "brute", category: "dragon", subtypes: ["fire"] },
    abilities: { mode: "auto", count: 2, complexity: "standard", powerBudget: "auto" },
    specialFeatures: { auras: { mode: "none" }, afflictions: { mode: "none" } },
    spellcasting: { mode: "none" },
    generation: { seed: "d1", variation: "balanced" }
  });
  const breath = blueprint.abilities.find((ability) => ability.signature?.kind === "dragon-breath");
  assert.ok(breath);
  assert.equal(breath.mechanics.damage.type, "fire");
  assert.equal(blueprint.metadata.signatureBudget.bonus, 3);
  assert.equal(blueprint.metadata.signatureBudget.spent, 3);
  assert.equal(blueprint.abilities.length, 2);
  assert.ok(blueprint.resources.effects.some((resource) => resource.id === breath.applications[0].ref));
});

test("dragons without a recognized elemental or energy affinity do not receive a random breath weapon", () => {
  const { generator } = setup();
  const blueprint = generator.generate({
    identity: { name: "Unbound Dragon", level: 8, role: "brute", category: "dragon", subtypes: [] },
    abilities: { mode: "auto", count: 2, complexity: "standard" },
    specialFeatures: { auras: { mode: "none" }, afflictions: { mode: "none" } },
    spellcasting: { mode: "none" },
    generation: { seed: "unbound-dragon" }
  });
  assert.ok(!blueprint.abilities.some((ability) => ability.signature?.kind === "dragon-breath"));
  assert.equal(blueprint.metadata.signatureBudget.bonus, 0);
});

test("manual ability budgets do not receive a hidden signature bonus", () => {
  const { generator } = setup();
  const blueprint = generator.generate({
    identity: { name: "Budget Drake", level: 8, role: "brute", category: "dragon", subtypes: ["fire"] },
    abilities: { mode: "auto", count: 2, complexity: "standard", powerBudget: 3 },
    specialFeatures: { auras: { mode: "none" }, afflictions: { mode: "none" } },
    spellcasting: { mode: "none" },
    generation: { seed: "d1" }
  });
  assert.equal(blueprint.metadata.signatureBudget.bonus, 0);
  assert.equal(blueprint.metadata.specialFeatureBudget.limit, 3);
});

test("signature reroll keeps dragon breath semantics while allowing its shape to change", () => {
  const { generator } = setup();
  const blueprint = generator.generate({
    identity: { name: "Ember Drake", level: 8, role: "brute", category: "dragon", subtypes: ["fire"] },
    abilities: { mode: "auto", count: 2, complexity: "standard" },
    specialFeatures: { auras: { mode: "none" }, afflictions: { mode: "none" } },
    spellcasting: { mode: "none" },
    generation: { seed: "d1" }
  });
  const before = blueprint.abilities.find((ability) => ability.signature?.kind === "dragon-breath");
  assert.ok(before);
  const rerolled = generator.reroll(blueprint, { scope: `ability:${before.id}`, seed: "different-breath-shape" });
  const after = rerolled.abilities.find((ability) => ability.id === before.id);
  assert.equal(after.signature.kind, "dragon-breath");
  assert.equal(after.mechanics.damage.type, "fire");
  assert.ok(rerolled.resources.effects.some((resource) => resource.id === after.applications[0].ref));
});

test("compiled breath weapon presents mechanics and retains signature metadata", () => {
  const previous = globalThis.game;
  globalThis.game = { i18n: { lang: "de", localize: (key) => key } };
  try {
    const { generator } = setup();
    const blueprint = generator.generate({
      identity: { name: "Ember Drake", level: 8, role: "brute", category: "dragon", subtypes: ["fire"] },
      abilities: { mode: "auto", count: 2 },
      specialFeatures: { auras: { mode: "none" }, afflictions: { mode: "none" } },
      spellcasting: { mode: "none" },
      generation: { seed: "d1" }
    });
    const source = compileActorSource(blueprint).actorSource;
    const item = source.items.find((entry) => entry.flags?.["pf2e-creature-forge"]?.signature?.kind === "dragon-breath");
    assert.ok(item);
    assert.equal(item.name, "Odemwaffe");
    assert.match(item.system.description.value, /9W?d?6|9d6/i);
    assert.match(item.system.description.value, /Feuer/);
    assert.match(item.system.description.value, /Reflex/);
    assert.match(item.system.description.value, /@Template\[type:(?:cone|line)\|distance:(?:15|30)\]/);
    assert.match(item.system.description.value, /Bereichsvorlage/);
  } finally {
    globalThis.game = previous;
  }
});

test("expanded core ability library covers additional creature families", () => {
  assert.ok(CORE_ABILITIES.length >= 40);
  const ids = new Set(CORE_ABILITIES.map((ability) => ability.slug));
  for (const id of ["dragon-breath", "wing-buffet", "life-drain", "emergency-repair", "spore-bloom", "adhesive-body", "psychic-pulse", "sweeping-blow", "radiant-rebuke", "planar-correction"]) {
    assert.ok(ids.has(id), `missing expanded core ability ${id}`);
  }
});
