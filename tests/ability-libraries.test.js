import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import { estimateAbilityPower, listAbilityCandidates } from "../scripts/core/ability-engine.js";
import { compileActorSource } from "../scripts/core/compiler.js";

function setup() {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  return { registry, generator: new CreatureGenerator({ registry }) };
}

function externalLibrary() {
  return {
    id: "test-horrors.ability-library",
    moduleId: "test-horrors",
    version: "1.0.0",
    label: "Test Horrors",
    defaultEnabled: false,
    content: {
      effects: [{
        id: "test-horrors.effect.marked",
        definition: {
          schemaVersion: 2,
          id: "test-horrors.effect.marked",
          name: "Marked",
          components: [{ type: "condition", slug: "off-guard" }]
        }
      }],
      abilities: [{
        id: "test-horrors.ability.marking-cry",
        slug: "marking-cry",
        abilityType: "action",
        actionCost: 1,
        category: "offensive",
        family: "marking-cry",
        powerCost: 2,
        baseWeight: 1000000,
        selection: { categories: ["humanoid"] },
        applications: [{ type: "effect", ref: "test-horrors.effect.marked", target: "target", timing: "on-success" }]
      }]
    }
  };
}

test("ability libraries register content with provenance and can be selected independently", () => {
  const { registry } = setup();
  const library = registry.registerAbilityLibrary(externalLibrary());
  assert.equal(library.abilityCount, 1);
  assert.equal(registry.get("ability", "test-horrors.ability.marking-cry").source.libraryId, library.id);
  assert.deepEqual(registry.getDefaultAbilityLibraryIds(), ["pf2e-creature-forge.ability-library.core"]);

  const baseRequest = { sources: { abilities: [] }, abilities: { mode: "auto", count: 2, complexity: "standard", focus: [] } };
  const defaultCandidates = listAbilityCandidates({ request: baseRequest, registry, level: 5, roleId: "custom", category: "humanoid", subtypes: [] });
  assert.equal(defaultCandidates.some((entry) => entry.id === "test-horrors.ability.marking-cry"), false);

  const selectedCandidates = listAbilityCandidates({ request: { ...baseRequest, sources: { abilities: [library.id] } }, registry, level: 5, roleId: "custom", category: "humanoid", subtypes: [] });
  assert.equal(selectedCandidates.some((entry) => entry.id === "test-horrors.ability.marking-cry"), true);
  assert.equal(selectedCandidates.some((entry) => entry.id === "pf2e-creature-forge.ability.menacing-display"), false);
});

test("loose API-registered abilities remain available alongside selected libraries", () => {
  const { registry } = setup();
  registry.register("ability", {
    id: "loose.ability",
    selection: { categories: ["humanoid"] },
    powerCost: 1
  }, { moduleId: "loose" });
  const candidates = listAbilityCandidates({
    request: { sources: { abilities: ["pf2e-creature-forge.ability-library.core"] }, abilities: { mode: "auto", count: 2, complexity: "standard", focus: [] } },
    registry,
    level: 5,
    roleId: "custom",
    category: "humanoid",
    subtypes: []
  });
  assert.ok(candidates.some((entry) => entry.id === "loose.ability"));
});

test("missing ability dependencies are diagnosed and excluded from generation", () => {
  const { registry } = setup();
  registry.registerAbilityLibrary({
    id: "broken.library",
    moduleId: "broken",
    defaultEnabled: false,
    abilities: [{
      id: "broken.ability",
      selection: { categories: ["ooze"] },
      applications: [{ type: "effect", ref: "broken.effect.missing", target: "target" }],
      baseWeight: 1000000
    }]
  });
  const dependency = registry.validateAbilityDependencies("broken.ability");
  assert.equal(dependency.valid, false);
  assert.equal(dependency.missing[0].ref, "broken.effect.missing");

  const candidates = listAbilityCandidates({
    request: { sources: { abilities: ["broken.library"] }, abilities: { mode: "auto", count: 1, complexity: "standard", focus: [] } },
    registry,
    level: 5,
    roleId: "custom",
    category: "ooze",
    subtypes: []
  });
  assert.deepEqual(candidates, []);
});

test("power budget prevents generation from overfilling expensive ability slots", () => {
  const { registry, generator } = setup();
  registry.registerAbilityLibrary({
    id: "expensive.library",
    moduleId: "expensive",
    defaultEnabled: false,
    abilities: [
      { id: "expensive.one", selection: { categories: ["humanoid"] }, powerCost: 3, baseWeight: 1000000 },
      { id: "expensive.two", selection: { categories: ["humanoid"] }, powerCost: 3, baseWeight: 1000000 }
    ]
  });
  const blueprint = generator.generate({
    identity: { name: "Budget Test", level: 5, role: "custom", category: "humanoid" },
    sources: { abilities: ["expensive.library"] },
    abilities: { mode: "auto", count: 2, complexity: "standard", powerBudget: 3 },
    generation: { seed: "power-budget" }
  });
  assert.equal(blueprint.abilities.length, 1);
  assert.equal(blueprint.metadata.abilityBudget.limit, 3);
  assert.equal(blueprint.metadata.abilityBudget.spent, 3);
  assert.ok(blueprint.diagnostics.some((entry) => entry.code === "ABILITY_BUDGET_EXHAUSTED"));
});

test("power estimation remains deterministic and explicit power costs win", () => {
  assert.equal(estimateAbilityPower({ abilityType: "reaction" }), 2);
  assert.equal(estimateAbilityPower({ abilityType: "action", actionCost: 2, tags: ["area"] }), 3);
  assert.equal(estimateAbilityPower({ powerCost: 5, abilityType: "passive" }), 5);
});

test("single-slot reroll reserves power for preserved later abilities", () => {
  const { registry, generator } = setup();
  registry.registerAbilityLibrary({
    id: "reroll.library",
    moduleId: "reroll",
    defaultEnabled: false,
    abilities: [
      { id: "reroll.cheap-a", selection: { categories: ["humanoid"] }, powerCost: 1, baseWeight: 10 },
      { id: "reroll.cheap-b", selection: { categories: ["humanoid"] }, powerCost: 1, baseWeight: 10 },
      { id: "reroll.expensive", selection: { categories: ["humanoid"] }, powerCost: 3, baseWeight: 1000000 }
    ]
  });
  const blueprint = generator.generate({
    identity: { level: 5, role: "custom", category: "humanoid" },
    sources: { abilities: ["reroll.library"] },
    abilities: { mode: "auto", count: 2, powerBudget: 4 },
    generation: { seed: "reroll-reserve-start" }
  });
  blueprint.abilities[1].locked = true;
  const laterCost = blueprint.abilities[1].powerCost;
  const rerolled = generator.reroll(blueprint, { scope: "ability:ability-1", seed: "reroll-reserve-next" });
  assert.ok(rerolled.metadata.abilityBudget.spent <= 4);
  assert.equal(rerolled.abilities[1].powerCost, laterCost);
});

test("compiled ability flags retain library provenance and power cost", () => {
  const { generator } = setup();
  const blueprint = generator.generate({
    identity: { level: 5, role: "custom", category: "humanoid" },
    abilities: { mode: "auto", count: 1, focus: ["fear"] },
    generation: { seed: "compiled-library-provenance" }
  });
  const source = compileActorSource(blueprint).actorSource;
  const item = source.items.find((entry) => entry.type === "action");
  assert.equal(item.flags["pf2e-creature-forge"].source.libraryId, "pf2e-creature-forge.ability-library.core");
  assert.equal(item.flags["pf2e-creature-forge"].powerCost, blueprint.abilities[0].powerCost);
});
