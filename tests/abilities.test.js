import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import { listAbilityCandidates } from "../scripts/core/ability-engine.js";
import { compileActorSource } from "../scripts/core/compiler.js";
import { validateBlueprint } from "../scripts/core/validator.js";

function setup() {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  return { registry, generator: new CreatureGenerator({ registry }) };
}

test("ability generation is deterministic for the same seed and varies across seeds", () => {
  const { generator } = setup();
  const request = {
    identity: { name: "Hunter", level: 5, role: "skirmisher", category: "animal" },
    abilities: { mode: "auto", count: 2, complexity: "standard" },
    generation: { seed: "abilities-fixed" }
  };
  const first = generator.generate(request);
  const second = generator.generate(request);
  assert.deepEqual(first.abilities, second.abilities);

  const signatures = new Set();
  for (let index = 0; index < 16; index += 1) {
    const blueprint = generator.generate({ ...request, generation: { seed: `ability-var-${index}` } });
    signatures.add(blueprint.abilities.map((ability) => ability.contentId).join("|"));
  }
  assert.ok(signatures.size > 1, "different seeds should produce more than one legal ability combination");
});

test("category and subtype filters expose concept-appropriate ability candidates", () => {
  const { registry } = setup();
  const request = {
    sources: { abilities: [] },
    abilities: { mode: "auto", count: 3, complexity: "standard", focus: [] }
  };
  const ghost = listAbilityCandidates({ request, registry, level: 8, roleId: "spellcaster", category: "undead", subtypes: ["ghost", "incorporeal"] });
  const ids = new Set(ghost.map((entry) => entry.id));
  assert.ok(ids.has("pf2e-creature-forge.ability.terrifying-moan"));
  assert.ok(ids.has("pf2e-creature-forge.ability.phasing-rush"));
  assert.ok(!ids.has("pf2e-creature-forge.ability.reactive-plating"));
});

test("ability mode off yields no abilities or generated effect resources", () => {
  const { generator } = setup();
  const blueprint = generator.generate({
    identity: { name: "Plain", level: 5, role: "custom", category: "humanoid" },
    abilities: { mode: "off" },
    generation: { seed: "none" }
  });
  assert.deepEqual(blueprint.abilities, []);
  assert.deepEqual(blueprint.resources.effects, []);
});

test("effect-backed abilities collect only referenced Effect Forge definitions", () => {
  const { generator } = setup();
  const blueprint = generator.generate({
    identity: { name: "Threat", level: 5, role: "custom", category: "humanoid" },
    abilities: { mode: "auto", count: 1, complexity: "standard", focus: ["fear"] },
    generation: { seed: "menacing" }
  });
  assert.equal(blueprint.abilities.length, 1);
  assert.equal(blueprint.abilities[0].contentId, "pf2e-creature-forge.ability.menacing-display");
  assert.equal(blueprint.resources.effects.length, 1);
  assert.equal(blueprint.resources.effects[0].id, "pf2e-creature-forge.effect.frightened-1");
  assert.equal(blueprint.resources.effects[0].definition.schemaVersion, 2);
  assert.equal(validateBlueprint(blueprint).valid, true);
});

test("single ability reroll excludes the previous content while preserving unrelated sections", () => {
  const { generator } = setup();
  const blueprint = generator.generate({
    identity: { name: "Hunter", level: 5, role: "skirmisher", category: "animal" },
    abilities: { mode: "auto", count: 2, complexity: "standard" },
    generation: { seed: "reroll-start" }
  });
  const previous = blueprint.abilities[0].contentId;
  const attacks = structuredClone(blueprint.combat.attacks);
  const stats = structuredClone(blueprint.statistics);
  const rerolled = generator.reroll(blueprint, { scope: "ability:ability-1", seed: "reroll-new" });
  assert.notEqual(rerolled.abilities[0].contentId, previous);
  assert.deepEqual(rerolled.combat.attacks, attacks);
  assert.deepEqual(rerolled.statistics, stats);
});

test("locked abilities survive section rerolls", () => {
  const { generator } = setup();
  const blueprint = generator.generate({
    identity: { name: "Hunter", level: 5, role: "skirmisher", category: "animal" },
    abilities: { mode: "auto", count: 2, complexity: "standard" },
    generation: { seed: "lock-start" }
  });
  blueprint.abilities[0].locked = true;
  const locked = structuredClone(blueprint.abilities[0]);
  const rerolled = generator.reroll(blueprint, { scope: "abilities", seed: "lock-reroll" });
  assert.deepEqual(rerolled.abilities[0], locked);
});

test("externally registered ability/effect content participates in weighted generation", () => {
  const { registry, generator } = setup();
  registry.registerBundle({
    id: "test.horror-pack",
    moduleId: "test-horror-pack",
    version: "1.0.0",
    content: {
      effects: [{
        id: "test-horror-pack.effect.sticky",
        slug: "sticky",
        definition: { schemaVersion: 2, id: "test-horror-pack.effect.sticky", name: "Sticky", description: "", img: "icons/svg/net.svg", duration: { value: 1, unit: "rounds", expiry: "turn-end" }, components: [{ type: "condition", slug: "off-guard" }], application: { targetType: "actor", stacking: "replace", incompatibilityMode: "warn" }, metadata: { originModule: "test-horror-pack" } }
      }],
      abilities: [{
        id: "test-horror-pack.ability.adhesive-wave",
        slug: "adhesive-wave",
        abilityType: "action",
        actionCost: 2,
        category: "offensive",
        family: "adhesive-wave",
        baseWeight: 1000000000,
        tags: ["ooze", "control"],
        selection: { categories: ["ooze"] },
        applications: [{ type: "effect", ref: "test-horror-pack.effect.sticky", target: "failed-save-target", timing: "failed-save" }]
      }]
    }
  });
  const blueprint = generator.generate({
    identity: { name: "Adhesive Horror", level: 6, role: "custom", category: "ooze" },
    abilities: { mode: "auto", count: 1 },
    generation: { seed: "external-ability" }
  });
  assert.equal(blueprint.abilities[0].contentId, "test-horror-pack.ability.adhesive-wave");
  assert.equal(blueprint.abilities[0].source.moduleId, "test-horror-pack");
  assert.equal(blueprint.resources.effects[0].id, "test-horror-pack.effect.sticky");
});

test("compiler materializes ability definitions as PF2E action items with integration metadata", () => {
  const { generator } = setup();
  const blueprint = generator.generate({
    identity: { name: "Threat", level: 5, role: "custom", category: "humanoid" },
    abilities: { mode: "auto", count: 1, focus: ["fear"] },
    generation: { seed: "compile-ability" }
  });
  const source = compileActorSource(blueprint).actorSource;
  const item = source.items.find((entry) => entry.type === "action");
  assert.ok(item);
  assert.equal(item.system.actionType.value, "action");
  assert.equal(item.system.actions.value, 1);
  assert.equal(item.flags["pf2e-creature-forge"].contentId, blueprint.abilities[0].contentId);
  assert.deepEqual(item.flags["pf2e-creature-forge"].applications, blueprint.abilities[0].applications);
});
