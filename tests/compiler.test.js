import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import { compileActorSource } from "../scripts/core/compiler.js";

test("compiler creates a PF2E NPC source with blueprint provenance and strikes", () => {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  const generator = new CreatureGenerator({ registry });
  const blueprint = generator.generate({
    identity: { name: "Forge Test", level: 4, role: "skirmisher", category: "animal", subtypes: ["aquatic"], size: "med" },
    options: { attackCount: 2 },
    generation: { seed: "compile" }
  });
  const compiled = compileActorSource(blueprint);
  assert.equal(compiled.actorSource.type, "npc");
  assert.equal(compiled.actorSource.name, "Forge Test");
  assert.equal(compiled.actorSource.system.details.level.value, 4);
  assert.equal(compiled.actorSource.system.attributes.ac.value, blueprint.statistics.ac.value);
  assert.equal(compiled.actorSource.system.attributes.hp.max, blueprint.statistics.hp.value);
  assert.deepEqual(compiled.actorSource.system.traits.value, ["animal", "aquatic"]);
  assert.equal(compiled.actorSource.system.abilities.str.mod, blueprint.statistics.abilities.str.value);
  assert.equal(compiled.actorSource.system.abilities.dex.mod, blueprint.statistics.abilities.dex.value);
  const meleeItems = compiled.actorSource.items.filter((entry) => entry.type === "melee");
  assert.equal(meleeItems.length, 2);
  const item = meleeItems[0];
  assert.equal(item.type, "melee");
  assert.equal(item.system.bonus.value, blueprint.combat.attacks[0].attack.value);
  const damage = Object.values(item.system.damageRolls)[0];
  assert.equal(damage.damage, blueprint.combat.attacks[0].damage.formula);
  assert.equal(damage.damageType, blueprint.combat.attacks[0].damage.type);
  assert.equal(compiled.actorSource.flags["pf2e-creature-forge"].seed, "compile");
});

test("compiler carries ranged strike range into PF2E melee item source", () => {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  const generator = new CreatureGenerator({ registry });
  const blueprint = generator.generate({ identity: { name: "Sniper", level: 8, role: "sniper", category: "humanoid" }, generation: { seed: "range" } });
  const compiled = compileActorSource(blueprint);
  const meleeItem = compiled.actorSource.items.find((entry) => entry.type === "melee");
  assert.equal(meleeItem.type, "melee");
  assert.equal(meleeItem.system.range, 60);
});

test("compiler localizes generated and legacy core attack names when Foundry i18n is available", () => {
  const previousGame = globalThis.game;
  globalThis.game = {
    i18n: {
      localize: (key) => key === "PF2E_CREATURE_FORGE.AttackName.Fist" ? "Faust" : key
    }
  };
  try {
    const blueprint = {
      schemaVersion: 1,
      identity: { name: "Lokalisierung", level: 1, category: "construct", size: "med", traits: ["construct"] },
      statistics: {
        abilities: Object.fromEntries(["str","dex","con","int","wis","cha"].map((key) => [key, { rank: "moderate", value: 0 }])),
        ac: { rank: "moderate", value: 15 }, hp: { rank: "moderate", value: 20 }, perception: { rank: "moderate", value: 5 }, speed: { land: 25 },
        saves: { fortitude: { rank: "moderate", value: 5 }, reflex: { rank: "moderate", value: 5 }, will: { rank: "moderate", value: 5 } }
      },
      combat: { attacks: [{ id: "attack-1", profile: "primary", name: "Fist", kind: "melee", attack: { rank: "moderate", value: 7 }, damage: { rank: "moderate", formula: "1d6+2", average: 5.5, type: "bludgeoning" }, traits: ["unarmed"], range: null }], spellcasting: [] },
      abilities: [], resources: { effects: [], auras: [], afflictions: [] }, loot: { policy: "auto" }, metadata: { seed: "localize", generatorVersion: "0.1.4" }
    };
    const compiled = compileActorSource(blueprint);
    assert.equal(compiled.actorSource.items[0].name, "Faust");
  } finally {
    globalThis.game = previousGame;
  }
});

test("compiler materializes generated skills, senses, and alternate movement into PF2E NPC source", () => {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  const generator = new CreatureGenerator({ registry });
  const blueprint = generator.generate({
    identity: { name: "Scout", level: 6, role: "skirmisher", category: "animal", subtypes: ["aquatic"] },
    skills: { count: 3, primaryRank: "high", preferred: ["stealth"] },
    movement: { land: 30, swim: 30, climb: 15, fly: "none", burrow: "none" },
    senses: { darkvision: "on", lowLightVision: "off", scent: "on", scentRange: 40 },
    generation: { seed: "compile-exploration" }
  });
  const compiled = compileActorSource(blueprint).actorSource;

  assert.ok(Object.keys(compiled.system.skills).length > 0);
  for (const [slug, skill] of Object.entries(blueprint.statistics.skills)) {
    assert.equal(compiled.system.skills[slug].base, skill.value);
    assert.deepEqual(compiled.system.skills[slug].special, []);
  }
  assert.ok(compiled.system.perception.senses.some((sense) => sense.type === "darkvision"));
  assert.deepEqual(compiled.system.perception.senses.find((sense) => sense.type === "scent"), {
    type: "scent",
    acuity: "imprecise",
    range: 40
  });
  assert.equal(compiled.system.attributes.speed.value, 30);
  assert.deepEqual(compiled.system.attributes.speed.otherSpeeds, [
    { type: "swim", value: 30 },
    { type: "climb", value: 15 }
  ]);
});

test("compiler materializes generated immunities, resistances, and weaknesses in current PF2E actor source shape", () => {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  const generator = new CreatureGenerator({ registry });
  const blueprint = generator.generate({
    identity: { name: "Hell Test", level: 10, category: "fiend", subtypes: ["devil"] },
    generation: { seed: "compile-iwr" }
  });
  const source = compileActorSource(blueprint).actorSource;
  assert.ok(source.system.attributes.immunities.some((entry) => entry.type === "fire"));
  assert.deepEqual(source.system.attributes.weaknesses.find((entry) => entry.type === "holy"), { type: "holy", value: 13 });
  assert.deepEqual(source.system.attributes.resistances.find((entry) => entry.type === "physical"), {
    type: "physical",
    value: 7,
    exceptions: ["silver"]
  });
  assert.ok(!("source" in source.system.attributes.weaknesses[0]));
});
