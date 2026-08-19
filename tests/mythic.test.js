import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import { compileActorSource } from "../scripts/core/compiler.js";
import { applyMythicOverlay } from "../scripts/core/mythic.js";
import { createEmptyBlueprint } from "../scripts/core/schemas.js";
import { validateBlueprint } from "../scripts/core/validator.js";

function makeGenerator() {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  return new CreatureGenerator({ registry });
}

test("mythic ambusher applies the War of Immortals role template and level adjustments", () => {
  const bp = makeGenerator().generate({
    identity: { level: 12, role: "sniper", category: "humanoid" },
    mythic: { enabled: true, role: "ambusher" },
    generation: { seed: "mythic-ambusher" }
  });
  assert.equal(bp.mythic.enabled, true);
  assert.equal(bp.mythic.role, "ambusher");
  assert.ok(bp.identity.traits.includes("mythic"));
  assert.equal(bp.statistics.skills.stealth.rank, "extreme");
  assert.ok(bp.mythic.resilience.includes("reflex"));
  assert.equal(bp.mythic.resilience.length, 2);
  assert.equal(bp.mythic.resistance, 0);
  assert.deepEqual(bp.mythic.points, { value: 3, max: 3 });
  assert.ok(bp.mythic.actions.some((entry) => entry.id === "mythic-hazard-immunity"));
  assert.ok(bp.mythic.actions.some((entry) => entry.id === "mythic-skill"));
  assert.ok(bp.mythic.actions.some((entry) => entry.id === "mythic-recharge"));
});

test("mythic brute uses full-level mythic resistance, extreme Athletics, ferocity and Titanic Might", () => {
  const bp = makeGenerator().generate({
    identity: { level: 7, role: "brute", category: "giant" },
    mythic: { enabled: true, role: "brute" },
    generation: { seed: "mythic-brute" }
  });
  assert.equal(bp.mythic.resistance, 7);
  assert.deepEqual(bp.mythic.resilience, []);
  assert.equal(bp.statistics.skills.athletics.rank, "extreme");
  assert.ok(bp.mythic.actions.some((entry) => entry.id === "mythic-ferocity" && entry.type === "reaction"));
  assert.ok(bp.mythic.actions.some((entry) => entry.id === "mythic-titanic-might"));
});

test("mythic striker follows its Fortitude and Remove a Condition restrictions", () => {
  const bp = makeGenerator().generate({
    identity: { level: 24, role: "skirmisher", category: "animal" },
    mythic: { enabled: true, role: "striker" },
    generation: { seed: "mythic-striker" }
  });
  assert.equal(bp.statistics.skills.acrobatics.rank, "extreme");
  assert.ok(!bp.mythic.resilience.includes("fortitude"));
  assert.ok(!bp.mythic.actions.some((entry) => entry.id === "mythic-remove-condition"));
  assert.equal(bp.mythic.immunity, "strikes");
  assert.ok(bp.mythic.actions.some((entry) => entry.id === "mythic-undying-myth"));
  assert.ok(bp.mythic.actions.some((entry) => entry.id === "mythic-reroll"));
});

test("mythic caster applies high/extreme spellcasting and extreme tradition skill", () => {
  const bp = createEmptyBlueprint();
  bp.identity.level = 12;
  bp.identity.role = "spellcaster";
  bp.identity.traits = ["undead"];
  bp.statistics.saves = {
    fortitude: { rank: "low", value: 16 },
    reflex: { rank: "moderate", value: 21 },
    will: { rank: "high", value: 24 }
  };
  bp.combat.spellcasting = [{ id: "spellcasting-1", enabled: true, tradition: "arcane", style: "prepared", dcRank: "moderate", dc: 27, attack: 19, highestRank: 6, spells: [] }];
  applyMythicOverlay(bp, { identity: { role: "spellcaster" }, mythic: { enabled: true, role: "caster" } });
  assert.equal(bp.combat.spellcasting[0].dcRank, "extreme");
  assert.equal(bp.combat.spellcasting[0].dc, 36);
  assert.equal(bp.combat.spellcasting[0].attack, 28);
  assert.equal(bp.statistics.skills.arcana.rank, "extreme");
  assert.deepEqual(new Set(bp.mythic.resilience), new Set(["will", "reflex"]));
  assert.ok(!bp.mythic.resilience.includes("fortitude"));
  assert.equal(bp.mythic.resistance, 0);
  assert.ok(bp.mythic.actions.some((entry) => entry.id === "mythic-recharge-spell"));
});

test("compiler writes mythic trait, 3-point NPC resource and mythic action items", () => {
  const bp = makeGenerator().generate({
    identity: { level: 7, role: "brute", category: "giant" },
    mythic: { enabled: true, role: "brute" },
    generation: { seed: "mythic-compiler" }
  });
  const { actorSource, integrationPlan } = compileActorSource(bp);
  assert.ok(actorSource.system.traits.value.includes("mythic"));
  assert.deepEqual(actorSource.system.resources.mythicPoints, { value: 3, max: 3 });
  assert.ok(actorSource.items.some((item) => item.flags?.["pf2e-creature-forge"]?.mythicAbilityId === "mythic-ferocity"));
  assert.equal(integrationPlan.mythic.role, "brute");
});

test("automatic mythic role maps ordinary creature roles deterministically", () => {
  const generator = makeGenerator();
  assert.equal(generator.generate({ identity: { level: 4, role: "soldier", category: "humanoid" }, mythic: { enabled: true, role: "auto" }, generation: { seed: "map-soldier" } }).mythic.role, "brute");
  assert.equal(generator.generate({ identity: { level: 4, role: "sniper", category: "humanoid" }, mythic: { enabled: true, role: "auto" }, generation: { seed: "map-sniper" } }).mythic.role, "ambusher");
  assert.equal(generator.generate({ identity: { level: 4, role: "skirmisher", category: "humanoid" }, mythic: { enabled: true, role: "auto" }, generation: { seed: "map-skirmisher" } }).mythic.role, "striker");
});

test("mythic role-mandated extreme skills do not trigger the ordinary extreme-skill warning", () => {
  const blueprint = makeGenerator().generate({
    identity: { level: 10, role: "skillParagon", category: "humanoid" },
    mythic: { enabled: true, role: "ambusher" },
    generation: { seed: "mythic-extreme-validator" }
  });
  const validation = validateBlueprint(blueprint);
  assert.equal(validation.warnings.some((entry) => entry.code === "MANY_EXTREME_SKILLS"), false);
});
