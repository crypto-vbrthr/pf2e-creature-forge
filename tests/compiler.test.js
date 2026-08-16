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
  assert.equal(compiled.actorSource.items.length, 2);
  const item = compiled.actorSource.items[0];
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
  assert.equal(compiled.actorSource.items[0].type, "melee");
  assert.equal(compiled.actorSource.items[0].system.range, 60);
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
      abilities: [], resources: { effects: [], auras: [], afflictions: [] }, loot: { policy: "auto" }, metadata: { seed: "localize", generatorVersion: "0.1.3" }
    };
    const compiled = compileActorSource(blueprint);
    assert.equal(compiled.actorSource.items[0].name, "Faust");
  } finally {
    globalThis.game = previousGame;
  }
});
