import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import { RESISTANCE_WEAKNESS_TABLE } from "../scripts/core/defensive-affinities.js";

function setup() {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  return { registry, generator: new CreatureGenerator({ registry }) };
}

function has(entries, type, value = undefined) {
  return entries.some((entry) => entry.type === type && (value === undefined || entry.value === value));
}

test("GM Core resistance and weakness table covers -1 through 24", () => {
  assert.deepEqual(RESISTANCE_WEAKNESS_TABLE[-1], { maximum: 1, minimum: 1 });
  assert.deepEqual(RESISTANCE_WEAKNESS_TABLE[10], { maximum: 13, minimum: 7 });
  assert.deepEqual(RESISTANCE_WEAKNESS_TABLE[24], { maximum: 26, minimum: 13 });
  assert.equal(Object.keys(RESISTANCE_WEAKNESS_TABLE).length, 26);
});

test("category and subtype rules create scaled defensive affinities", () => {
  const { generator } = setup();
  const bp = generator.generate({
    identity: { level: 10, role: "custom", category: "elemental", subtypes: ["fire"] },
    generation: { seed: "fire-elemental" }
  });
  assert.ok(has(bp.defenses.immunities, "fire"));
  assert.ok(has(bp.defenses.immunities, "bleed"));
  assert.ok(has(bp.defenses.immunities, "poison"));
  assert.ok(has(bp.defenses.resistances, "cold", 13));
});

test("celestials and fiends receive sanctification traits and opposing weaknesses", () => {
  const { generator } = setup();
  const celestial = generator.generate({ identity: { level: 8, category: "celestial" }, generation: { seed: "holy" } });
  assert.ok(celestial.identity.traits.includes("holy"));
  assert.ok(has(celestial.defenses.weaknesses, "unholy", 11));

  const fiend = generator.generate({ identity: { level: 8, category: "fiend" }, generation: { seed: "unholy" } });
  assert.ok(fiend.identity.traits.includes("unholy"));
  assert.ok(has(fiend.defenses.weaknesses, "holy", 11));
});

test("ghost subtype implies incorporeal defenses and feeds HP tradeoff", () => {
  const { generator } = setup();
  const bp = generator.generate({
    identity: { level: 8, role: "custom", category: "undead", subtypes: ["ghost"] },
    generation: { seed: "ghost" }
  });
  assert.ok(bp.identity.resolvedSubtypes.includes("incorporeal"));
  assert.ok(bp.identity.traits.includes("incorporeal"));
  const resistance = bp.defenses.resistances.find((entry) => entry.type === "all-damage");
  assert.equal(resistance.value, 6);
  assert.deepEqual(resistance.exceptions, ["force", "ghost-touch", "spirit"]);
  assert.deepEqual(resistance.doubleVs, ["non-magical"]);
  assert.equal(bp.defenses.hpAdjustment.value, -12);
  assert.equal(bp.statistics.hp.value, bp.statistics.hp.baseValue - 12);
});

test("swarm gets precision immunity, area weakness, and physical resistance", () => {
  const { generator } = setup();
  const bp = generator.generate({
    identity: { level: 6, category: "animal", subtypes: ["swarm"] },
    generation: { seed: "swarm" }
  });
  assert.ok(has(bp.defenses.immunities, "precision"));
  assert.ok(has(bp.defenses.immunities, "grabbed"));
  assert.ok(has(bp.defenses.immunities, "prone"));
  assert.ok(has(bp.defenses.immunities, "restrained"));
  assert.ok(has(bp.defenses.weaknesses, "area-damage", 9));
  assert.ok(has(bp.defenses.resistances, "physical", 5));
});

test("external subtypes can contribute traits and defensive affinities", () => {
  const { registry, generator } = setup();
  registry.register("subtype", {
    id: "test-pack.crystal",
    slug: "crystal",
    trait: "earth",
    label: "Crystal",
    grantedTraits: ["magical"],
    defensiveAffinities: [
      { id: "sonic-weakness", kind: "weakness", type: "sonic", scale: "maximum" },
      { id: "physical-resistance", kind: "resistance", type: "physical", scale: "minimum" }
    ]
  }, { moduleId: "test-pack", version: "1.0.0" });
  const bp = generator.generate({
    identity: { level: 5, category: "construct", subtypes: ["crystal"] },
    generation: { seed: "external-crystal" }
  });
  assert.ok(bp.identity.traits.includes("earth"));
  assert.ok(bp.identity.traits.includes("magical"));
  assert.ok(has(bp.defenses.weaknesses, "sonic", 8));
  assert.ok(has(bp.defenses.resistances, "physical", 4));
  assert.equal(bp.defenses.weaknesses.find((entry) => entry.type === "sonic").source.moduleId, "test-pack");
});

test("manual affinities survive automation and can override a conflicting generated resistance", () => {
  const { generator } = setup();
  const bp = generator.generate({
    identity: { level: 10, category: "elemental", subtypes: ["fire"] },
    defensiveAffinities: { weaknesses: [{ type: "cold", value: 9 }] },
    generation: { seed: "manual-affinity" }
  });
  assert.ok(has(bp.defenses.weaknesses, "cold", 9));
  assert.ok(!has(bp.defenses.resistances, "cold"));
  assert.equal(bp.defenses.weaknesses.find((entry) => entry.type === "cold").source.kind, "manual");
});

test("affinity reroll preserves unrelated combat data and keeps HP compensation consistent", () => {
  const { generator } = setup();
  const original = generator.generate({
    identity: { level: 8, category: "plant" },
    options: { attackCount: 2 },
    generation: { seed: "plant-a", variation: "experimental" }
  });
  const rerolled = generator.reroll(original, { scope: "defenses.affinities", seed: "plant-b" });
  assert.deepEqual(rerolled.combat, original.combat);
  assert.deepEqual(rerolled.statistics.ac, original.statistics.ac);
  assert.equal(rerolled.statistics.hp.baseValue, original.statistics.hp.baseValue);
  assert.equal(rerolled.statistics.hp.value, rerolled.statistics.hp.baseValue + rerolled.defenses.hpAdjustment.value);
});
