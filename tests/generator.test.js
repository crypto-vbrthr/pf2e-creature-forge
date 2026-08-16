import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";

function makeGenerator() {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  return new CreatureGenerator({ registry });
}

test("same request and seed produce the same blueprint", () => {
  const generator = makeGenerator();
  const request = {
    identity: { name: "Test", level: 10, role: "soldier", category: "construct", subtypes: ["fire"], size: "lg" },
    generation: { seed: "fixed-seed" }
  };
  assert.deepEqual(generator.generate(request), generator.generate(request));
});

test("different seeds create variation inside the same legal HP band", () => {
  const generator = makeGenerator();
  const values = new Set();
  for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
    const bp = generator.generate({ identity: { level: 10, role: "custom", category: "humanoid" }, generation: { seed } });
    values.add(bp.statistics.hp.value);
    assert.ok(bp.statistics.hp.value >= 171 && bp.statistics.hp.value <= 179);
  }
  assert.ok(values.size > 1);
});

test("role defaults remain overridable by explicit ranks", () => {
  const generator = makeGenerator();
  const bp = generator.generate({
    identity: { level: 5, role: "brute", category: "giant" },
    attributes: { str: "moderate", dex: "high" },
    defenses: { ac: "high", hp: "low", saves: { fortitude: "moderate", reflex: "extreme", will: "terrible" } },
    offense: { attack: "moderate", damage: "extreme" },
    generation: { seed: "override" }
  });
  assert.equal(bp.statistics.abilities.str.rank, "moderate");
  assert.equal(bp.statistics.abilities.dex.rank, "high");
  assert.equal(bp.statistics.ac.rank, "high");
  assert.equal(bp.statistics.hp.rank, "low");
  assert.equal(bp.statistics.saves.reflex.rank, "extreme");
  assert.equal(bp.statistics.saves.will.rank, "terrible");
  assert.equal(bp.combat.attacks[0].attack.rank, "moderate");
  assert.equal(bp.combat.attacks[0].damage.rank, "extreme");
});

test("role road maps generate ability modifiers and speed", () => {
  const generator = makeGenerator();
  const brute = generator.generate({ identity: { level: 8, role: "brute", category: "giant" }, generation: { seed: "brute" } });
  assert.equal(brute.statistics.abilities.str.rank, "high");
  assert.equal(brute.statistics.abilities.con.rank, "high");
  const skirmisher = generator.generate({ identity: { level: 8, role: "skirmisher", category: "animal" }, generation: { seed: "skirmish" } });
  assert.equal(skirmisher.statistics.speed.land, 35);
  assert.equal(skirmisher.statistics.abilities.dex.rank, "high");
});

test("mindless and animal concepts get concept-sensitive intelligence defaults", () => {
  const generator = makeGenerator();
  const mindless = generator.generate({ identity: { level: 5, role: "brute", category: "construct", subtypes: ["mindless"] }, generation: { seed: "mindless" } });
  assert.deepEqual(mindless.statistics.abilities.int, { rank: "terrible", value: -5 });
  const animal = generator.generate({ identity: { level: 5, role: "skirmisher", category: "animal" }, generation: { seed: "animal" } });
  assert.equal(animal.statistics.abilities.int.rank, "terrible");
  assert.ok([-5, -4].includes(animal.statistics.abilities.int.value));
});

test("two attacks form an accurate-low-damage and heavy-high-damage pair", () => {
  const generator = makeGenerator();
  const bp = generator.generate({
    identity: { level: 10, role: "soldier", category: "construct" },
    options: { attackCount: 2 },
    generation: { seed: "pair" }
  });
  assert.equal(bp.combat.attacks.length, 2);
  const [accurate, heavy] = bp.combat.attacks;
  assert.equal(accurate.profile, "accurate");
  assert.equal(heavy.profile, "heavy");
  assert.ok(accurate.attack.value > heavy.attack.value);
  assert.ok(accurate.damage.average < heavy.damage.average);
  assert.ok(accurate.traits.includes("agile"));
});

test("sniper road map generates ranged strikes", () => {
  const generator = makeGenerator();
  const bp = generator.generate({ identity: { level: 10, role: "sniper", category: "humanoid" }, options: { attackCount: 2 }, generation: { seed: "sniper" } });
  assert.ok(bp.combat.attacks.every((attack) => attack.kind === "ranged"));
  assert.ok(bp.combat.attacks.every((attack) => attack.range === 60));
});

test("HP-only reroll preserves other statistics", () => {
  const generator = makeGenerator();
  const original = generator.generate({ identity: { level: 8, role: "custom", category: "animal" }, generation: { seed: "one" } });
  const rerolled = generator.reroll(original, { scope: "statistics.hp", seed: "two" });
  assert.deepEqual(rerolled.statistics.ac, original.statistics.ac);
  assert.deepEqual(rerolled.statistics.saves, original.statistics.saves);
  assert.deepEqual(rerolled.statistics.abilities, original.statistics.abilities);
  assert.deepEqual(rerolled.combat.attacks, original.combat.attacks);
  assert.equal(rerolled.metadata.seed, "two");
});

test("attack reroll preserves statistics", () => {
  const generator = makeGenerator();
  const original = generator.generate({ identity: { level: 8, role: "brute", category: "animal" }, options: { attackCount: 2 }, generation: { seed: "one" } });
  const rerolled = generator.reroll(original, { scope: "combat.attacks", seed: "two" });
  assert.deepEqual(rerolled.statistics, original.statistics);
  assert.equal(rerolled.combat.attacks.length, 2);
  assert.equal(rerolled.metadata.seed, "two");
});

test("generated core attacks carry stable localization keys", () => {
  const generator = makeGenerator();
  const bp = generator.generate({
    identity: { level: 6, role: "skirmisher", category: "animal" },
    options: { attackCount: 2 },
    generation: { seed: "localized-attacks" }
  });
  assert.equal(bp.combat.attacks.length, 2);
  assert.ok(bp.combat.attacks.every((attack) => typeof attack.nameKey === "string" && attack.nameKey.startsWith("PF2E_CREATURE_FORGE.AttackName.")));
});
