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
    defenses: { ac: "high", hp: "low", saves: { fortitude: "moderate", reflex: "extreme", will: "terrible" } },
    generation: { seed: "override" }
  });
  assert.equal(bp.statistics.ac.rank, "high");
  assert.equal(bp.statistics.hp.rank, "low");
  assert.equal(bp.statistics.saves.reflex.rank, "extreme");
  assert.equal(bp.statistics.saves.will.rank, "terrible");
});

test("HP-only reroll preserves other statistics", () => {
  const generator = makeGenerator();
  const original = generator.generate({ identity: { level: 8, role: "custom", category: "animal" }, generation: { seed: "one" } });
  const rerolled = generator.reroll(original, { scope: "statistics.hp", seed: "two" });
  assert.deepEqual(rerolled.statistics.ac, original.statistics.ac);
  assert.deepEqual(rerolled.statistics.saves, original.statistics.saves);
  assert.equal(rerolled.metadata.seed, "two");
});
