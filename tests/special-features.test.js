import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import { compileActorSource } from "../scripts/core/compiler.js";
import { specialFeatureChance } from "../scripts/core/special-features.js";
import { CORE_AURAS, CORE_AFFLICTIONS } from "../scripts/core/core-special-features.js";

function setup() {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  return { registry, generator: new CreatureGenerator({ registry }) };
}

const baseAbilities = { mode: "auto", count: 1, complexity: "standard", powerBudget: 8 };

test("automatic special features are optional and concept-sensitive", () => {
  const mundane = specialFeatureChance({
    request: { specialFeatures: { frequency: "normal", auras: { mode: "auto" }, afflictions: { mode: "auto" } } },
    kind: "aura", category: "humanoid", subtypes: []
  });
  const ghost = specialFeatureChance({
    request: { specialFeatures: { frequency: "normal", auras: { mode: "auto" }, afflictions: { mode: "auto" } } },
    kind: "aura", category: "undead", subtypes: ["ghost", "incorporeal"]
  });
  const venomous = specialFeatureChance({
    request: { specialFeatures: { frequency: "normal", auras: { mode: "auto" }, afflictions: { mode: "auto" } } },
    kind: "affliction", category: "animal", subtypes: ["poison"]
  });
  assert.ok(mundane > 0 && mundane < 1);
  assert.ok(ghost > mundane);
  assert.ok(venomous > 0.5);
});

test("auto mode can generate no aura or affliction for a mundane concept", () => {
  const { generator } = setup();
  let foundEmpty = false;
  for (let i = 0; i < 24; i += 1) {
    const blueprint = generator.generate({
      identity: { level: 5, role: "soldier", category: "humanoid" },
      abilities: baseAbilities,
      specialFeatures: { frequency: "normal", auras: { mode: "auto" }, afflictions: { mode: "auto" } },
      generation: { seed: `mundane-auto-${i}` }
    });
    if (!blueprint.resources.auras.length && !blueprint.resources.afflictions.length) { foundEmpty = true; break; }
  }
  assert.equal(foundEmpty, true);
});

test("required mode forces a matching aura when one exists", () => {
  const { generator } = setup();
  const blueprint = generator.generate({
    identity: { level: 6, role: "spellcaster", category: "undead", subtypes: ["ghost"] },
    abilities: baseAbilities,
    specialFeatures: { frequency: "rare", auras: { mode: "required" }, afflictions: { mode: "none" } },
    generation: { seed: "required-ghost-aura" }
  });
  assert.equal(blueprint.resources.auras.length, 1);
  assert.equal(blueprint.resources.auras[0].contentId, "pf2e-creature-forge.aura.dread-presence");
  assert.equal(blueprint.resources.afflictions.length, 0);
});

test("required mode forces a matching affliction and none mode excludes the other kind", () => {
  const { generator } = setup();
  const blueprint = generator.generate({
    identity: { level: 5, role: "skirmisher", category: "animal", subtypes: ["poison"] },
    abilities: baseAbilities,
    specialFeatures: { frequency: "high", auras: { mode: "none" }, afflictions: { mode: "required" } },
    generation: { seed: "required-venom" }
  });
  assert.equal(blueprint.resources.auras.length, 0);
  assert.equal(blueprint.resources.afflictions.length, 1);
  assert.equal(blueprint.resources.afflictions[0].contentId, "pf2e-creature-forge.affliction.predator-venom");
});

test("required mode reports a warning instead of inserting an unrelated feature", () => {
  const { generator } = setup();
  const blueprint = generator.generate({
    identity: { level: 5, role: "soldier", category: "humanoid" },
    abilities: baseAbilities,
    specialFeatures: { auras: { mode: "required" }, afflictions: { mode: "required" } },
    generation: { seed: "required-but-no-match" }
  });
  assert.deepEqual(blueprint.resources.auras, []);
  assert.deepEqual(blueprint.resources.afflictions, []);
  assert.ok(blueprint.diagnostics.some((entry) => entry.code === "REQUIRED_AURA_UNAVAILABLE"));
  assert.ok(blueprint.diagnostics.some((entry) => entry.code === "REQUIRED_AFFLICTION_UNAVAILABLE"));
});

test("same seed reproduces aura and affliction decisions", () => {
  const { generator } = setup();
  const request = {
    identity: { level: 8, role: "custom", category: "fiend", subtypes: ["unholy"] },
    abilities: baseAbilities,
    specialFeatures: { frequency: "high", auras: { mode: "auto" }, afflictions: { mode: "auto" } },
    generation: { seed: "special-deterministic" }
  };
  const first = generator.generate(request);
  const second = generator.generate(request);
  assert.deepEqual(first.resources.auras, second.resources.auras);
  assert.deepEqual(first.resources.afflictions, second.resources.afflictions);
});

test("special features share the power budget with abilities", () => {
  const { generator } = setup();
  const blueprint = generator.generate({
    identity: { level: 6, role: "spellcaster", category: "undead", subtypes: ["ghost"] },
    abilities: { mode: "auto", count: 3, complexity: "complex", powerBudget: 4 },
    specialFeatures: { auras: { mode: "required" }, afflictions: { mode: "none" } },
    generation: { seed: "shared-special-budget" }
  });
  assert.equal(blueprint.metadata.specialFeatureBudget.limit, 4);
  assert.ok(blueprint.metadata.specialFeatureBudget.spent <= 4);
  assert.equal(
    blueprint.metadata.specialFeatureBudget.spent,
    blueprint.metadata.specialFeatureBudget.abilitySpent + blueprint.metadata.specialFeatureBudget.auraSpent + blueprint.metadata.specialFeatureBudget.afflictionSpent
  );
});

test("locked aura and affliction survive scoped rerolls", () => {
  const { generator } = setup();
  const auraBlueprint = generator.generate({
    identity: { level: 6, role: "spellcaster", category: "undead", subtypes: ["ghost"] },
    abilities: baseAbilities,
    specialFeatures: { auras: { mode: "required" }, afflictions: { mode: "none" } },
    generation: { seed: "locked-aura-start" }
  });
  auraBlueprint.resources.auras[0].locked = true;
  const lockedAura = structuredClone(auraBlueprint.resources.auras[0]);
  assert.deepEqual(generator.reroll(auraBlueprint, { scope: "auras", seed: "locked-aura-next" }).resources.auras[0], lockedAura);

  const afflictionBlueprint = generator.generate({
    identity: { level: 5, role: "skirmisher", category: "animal", subtypes: ["poison"] },
    abilities: baseAbilities,
    specialFeatures: { auras: { mode: "none" }, afflictions: { mode: "required" } },
    generation: { seed: "locked-affliction-start" }
  });
  afflictionBlueprint.resources.afflictions[0].locked = true;
  const lockedAffliction = structuredClone(afflictionBlueprint.resources.afflictions[0]);
  assert.deepEqual(generator.reroll(afflictionBlueprint, { scope: "afflictions", seed: "locked-affliction-next" }).resources.afflictions[0], lockedAffliction);
});

test("external aura and affliction libraries can expand selected generation pools", () => {
  const { registry, generator } = setup();
  registry.registerAuraLibrary({
    id: "test-specials.aura-library",
    moduleId: "test-specials",
    defaultEnabled: false,
    auras: [{
      id: "test-specials.aura.clockwork-hum",
      powerCost: 1,
      baseWeight: 1000000,
      selection: { categories: ["construct"] },
      definition: { schemaVersion: 1, id: "test-specials.aura.clockwork-hum", name: "Clockwork Hum", enabled: true, radius: 10, targeting: {}, presenceEffects: [], triggers: [], metadata: {} }
    }]
  });
  registry.registerAfflictionLibrary({
    id: "test-specials.affliction-library",
    moduleId: "test-specials",
    defaultEnabled: false,
    afflictions: [{
      id: "test-specials.affliction.machine-plague",
      powerCost: 1,
      baseWeight: 1000000,
      selection: { categories: ["construct"] },
      definition: { schemaVersion: 2, id: "test-specials.affliction.machine-plague", name: "Machine Plague", afflictionType: "curse", level: 1, traits: ["curse"], stages: [{ number: 1, name: "Stage 1", description: "", duration: { value: 1, unit: "rounds" } }] }
    }]
  });
  const blueprint = generator.generate({
    identity: { level: 5, role: "soldier", category: "construct" },
    sources: { auras: ["test-specials.aura-library"], afflictions: ["test-specials.affliction-library"] },
    abilities: { mode: "off", powerBudget: 4 },
    specialFeatures: { auras: { mode: "required" }, afflictions: { mode: "required" } },
    generation: { seed: "external-special-libraries" }
  });
  assert.equal(blueprint.resources.auras[0].contentId, "test-specials.aura.clockwork-hum");
  assert.equal(blueprint.resources.auras[0].source.libraryId, "test-specials.aura-library");
  assert.equal(blueprint.resources.afflictions[0].contentId, "test-specials.affliction.machine-plague");
  assert.equal(blueprint.resources.afflictions[0].source.libraryId, "test-specials.affliction-library");
});

test("compiler materializes generated afflictions as passive PF2E action items", () => {
  const { generator } = setup();
  const blueprint = generator.generate({
    identity: { level: 5, role: "skirmisher", category: "animal", subtypes: ["poison"] },
    abilities: baseAbilities,
    specialFeatures: { auras: { mode: "none" }, afflictions: { mode: "required" } },
    generation: { seed: "compile-affliction" }
  });
  const actorSource = compileActorSource(blueprint).actorSource;
  const item = actorSource.items.find((entry) => entry.flags?.["pf2e-creature-forge"]?.afflictionRef);
  assert.ok(item);
  assert.equal(item.type, "action");
  assert.equal(item.system.actionType.value, "passive");
  assert.equal(item.flags["pf2e-creature-forge"].afflictionRef, blueprint.resources.afflictions[0].id);
});


test("core Aura/Affliction definitions honor the current integration contracts", () => {
  const auraEvents = new Set(["enter", "leave", "turnStart", "turnEnd"]);
  const instantTypes = new Set(["damage", "death"]);
  for (const resource of CORE_AURAS) {
    assert.equal(resource.definition.schemaVersion, 1, `${resource.id} must use Aura schema v1`);
    for (const trigger of resource.definition.triggers ?? []) assert.ok(auraEvents.has(trigger.event), `${resource.id} has unsupported Aura event ${trigger.event}`);
    for (const presence of resource.definition.presenceEffects ?? []) {
      assert.equal((presence.effect?.components ?? []).some((component) => instantTypes.has(component?.type)), false, `${resource.id} may not put instant damage/death in Presence effects`);
    }
  }

  for (const resource of CORE_AFFLICTIONS) {
    const definition = resource.definition;
    assert.equal(definition.schemaVersion, 2, `${resource.id} must use Affliction schema v2`);
    for (const key of ["id", "name", "img", "afflictionType", "saveDefaults", "identification", "restrictions", "checks", "stages"]) {
      assert.notEqual(definition[key], undefined, `${resource.id} is missing ${key}`);
    }
    assert.ok(definition.stages.length > 0);
    for (const [index, stage] of definition.stages.entries()) {
      assert.equal(stage.number, index + 1);
      if (stage.effect) {
        assert.equal(stage.effect.duration?.unit, "unlimited");
        assert.equal(stage.effect.duration?.value, -1);
      }
    }
  }
});
