import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import { validateBlueprint } from "../scripts/core/validator.js";
import { compileActorSource } from "../scripts/core/compiler.js";
import { toggleSectionLock, canRerollSection, sectionLocked, adjustPreviewNumber, LOCKABLE_SECTIONS, sectionLockKey, normalizeBlueprintLocks } from "../scripts/core/blueprint-controls.js";

function makeGenerator() {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  return new CreatureGenerator({ registry });
}
const source = { identity: { level: 8, role: "brute", category: "animal" }, options: { attackCount: 2 }, generation: { seed: "controls-first" } };

test("locks are restricted to known generated sections", () => {
  const bp = makeGenerator().generate(source);
  assert.equal(LOCKABLE_SECTIONS.length, 13);
  assert.equal(toggleSectionLock(bp, "constructor"), false);
  assert.equal(toggleSectionLock(bp, "statistics.abilities"), true);
  assert.equal(sectionLocked(bp, "statistics.abilities"), true);
  assert.equal(toggleSectionLock(bp, "statistics.abilities"), true);
  assert.equal(sectionLocked(bp, "statistics.abilities"), false);
});

test("numeric adjustments affect blueprint values, HP base and generated strikes", () => {
  const bp = makeGenerator().generate(source);
  const str = bp.statistics.abilities.str.value;
  const hp = bp.statistics.hp.value;
  const hpBase = bp.statistics.hp.baseValue;
  const strike = bp.combat.attacks[0].attack.value;
  assert.equal(adjustPreviewNumber(bp, "statistics.abilities.str.value", 1), true);
  assert.equal(bp.statistics.abilities.str.value, str + 1);
  assert.equal(adjustPreviewNumber(bp, "statistics.hp.value", -1), true);
  assert.equal(bp.statistics.hp.value, hp - 1);
  assert.equal(bp.statistics.hp.baseValue, hpBase - 1);
  assert.equal(adjustPreviewNumber(bp, "combat.attacks.0.attack.value", 1), true);
  assert.equal(bp.combat.attacks[0].attack.value, strike + 1);
  assert.equal(adjustPreviewNumber(bp, "statistics.abilities.str.rank", 1), false);
  assert.equal(adjustPreviewNumber(bp, "__proto__.polluted", 1), false);
  assert.equal(adjustPreviewNumber(bp, "statistics.hp.value", 900), false);
  assert.equal(validateBlueprint(bp).valid, true);
});

test("all reroll preserves locked sections and unlocked sections can reroll independently", () => {
  const generator = makeGenerator();
  const bp = generator.generate(source);
  assert.equal(toggleSectionLock(bp, "statistics.abilities"), true);
  assert.equal(toggleSectionLock(bp, "combat.attacks"), true);
  assert.equal(toggleSectionLock(bp, "defenses"), true);
  adjustPreviewNumber(bp, "statistics.abilities.str.value", 1);
  adjustPreviewNumber(bp, "combat.attacks.0.attack.value", 1);
  adjustPreviewNumber(bp, "statistics.ac.value", 1);
  const all = generator.reroll(bp, { scope: "all", seed: "controls-second" });
  assert.deepEqual(all.statistics.abilities, bp.statistics.abilities);
  assert.deepEqual(all.combat.attacks, bp.combat.attacks);
  assert.deepEqual(all.statistics.ac, bp.statistics.ac);
  assert.deepEqual(all.statistics.hp, bp.statistics.hp);
  assert.deepEqual(all.statistics.saves, bp.statistics.saves);
  assert.deepEqual(all.defenses, bp.defenses);
  assert.deepEqual(all.statistics.skills, generator.generate({ ...source, generation: { seed: "controls-second" } }).statistics.skills);
  const rerolledSkills = generator.reroll(all, { scope: "statistics.skills", seed: "controls-third" });
  assert.deepEqual(rerolledSkills.statistics.abilities, bp.statistics.abilities);
  assert.deepEqual(rerolledSkills.combat.attacks, bp.combat.attacks);
  assert.deepEqual(rerolledSkills.statistics.skills, generator.generate({ ...source, generation: { seed: "controls-third" } }).statistics.skills);
  assert.equal(validateBlueprint(all).valid, true);
});

test("standalone reroll sections respect locks and do not mutate source blueprint", () => {
  const generator = makeGenerator();
  const bp = generator.generate(source);
  toggleSectionLock(bp, "statistics.skills");
  toggleSectionLock(bp, "statistics.movement");
  const previous = structuredClone(bp);
  const skills = generator.reroll(bp, { scope: "statistics.skills", seed: "keep-skills" });
  const movement = generator.reroll(bp, { scope: "statistics.movement", seed: "keep-movement" });
  assert.deepEqual(skills.statistics.skills, previous.statistics.skills);
  assert.deepEqual(movement.statistics.speed, previous.statistics.speed);
  assert.deepEqual(bp, previous);
});

test("all reroll preserves prior locked spells/abilities and keeps selected section locks", () => {
  const generator = makeGenerator();
  const bp = generator.generate(source);
  if (bp.abilities.length) bp.abilities[0].locked = true;
  const all = generator.reroll(bp, { scope: "all", seed: "after-lock" });
  if (bp.abilities.length) assert.ok(all.abilities.some((ability) => ability.id === bp.abilities[0].id && ability.locked));
  assert.equal(validateBlueprint(all).valid, true);
});

test("UI has separate scroll positions and accessible per-section controls", () => {
  const editor = readFileSync(new URL("../scripts/ui/creature-editor.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles/creature-forge.css", import.meta.url), "utf8");
  assert.match(editor, /data-cf-concept-scroll/);
  assert.match(editor, /data-cf-generated-scroll/);
  assert.match(editor, /panelScrollPositions/);
  assert.match(editor, /data-cf-action="toggle-section-lock"/);
  assert.match(editor, /data-cf-action="reroll-section"/);
  assert.match(editor, /data-cf-action="adjust-number"/);
  assert.match(css, /\.cf-editor \.cf-grid > \.cf-inputs,[\s\S]*?overflow-y: auto/);
});


test("modified numeric values arrive in the compiled PF2e NPC", () => {
  const bp = makeGenerator().generate(source);
  adjustPreviewNumber(bp, "statistics.ac.value", 1);
  adjustPreviewNumber(bp, "statistics.hp.value", 1);
  adjustPreviewNumber(bp, "statistics.abilities.dex.value", -1);
  adjustPreviewNumber(bp, "statistics.saves.reflex.value", 1);
  adjustPreviewNumber(bp, "combat.attacks.0.attack.value", 1);
  const actor = compileActorSource(bp).actorSource;
  assert.equal(actor.system.attributes.ac.value, bp.statistics.ac.value);
  assert.equal(actor.system.attributes.hp.max, bp.statistics.hp.value);
  assert.equal(actor.system.abilities.dex.mod, bp.statistics.abilities.dex.value);
  assert.equal(actor.system.saves.reflex.value, bp.statistics.saves.reflex.value);
  assert.equal(actor.items.find((entry) => entry.type === "melee").system.bonus.value, bp.combat.attacks[0].attack.value);
});

test("reroll all accepts edited concept request without discarding protected preview fields", () => {
  const generator = makeGenerator();
  const bp = generator.generate(source);
  toggleSectionLock(bp, "statistics.abilities");
  toggleSectionLock(bp, "combat.attacks");
  const next = generator.reroll(bp, { scope: "all", seed: "new-concept", request: {
    identity: { ...source.identity, name: "Changed", size: "lg" },
    options: source.options,
    generation: { seed: "old" }
  } });
  assert.equal(next.identity.name, "Changed");
  assert.equal(next.identity.size, "lg");
  assert.deepEqual(next.statistics.abilities, bp.statistics.abilities);
  assert.deepEqual(next.combat.attacks, bp.combat.attacks);
  assert.equal(next.locks[sectionLockKey("statistics.abilities")], true);
  assert.equal(next.metadata.requestSnapshot.identity.name, "Changed");
});

test("HP section lock survives affinity reroll while keeping compensation coherent", () => {
  const generator = makeGenerator();
  const bp = generator.generate({ ...source, generation: { seed: "rc-hp-locked" } });
  toggleSectionLock(bp, "statistics.hp");
  const value = bp.statistics.hp.value;
  const rerolled = generator.reroll(bp, { scope: "defenses.affinities", seed: "rc-new-affinities" });
  assert.equal(rerolled.statistics.hp.value, value);
  assert.equal(rerolled.statistics.hp.adjustment, Number(rerolled.defenses.hpAdjustment?.value ?? 0));
  assert.equal(rerolled.statistics.hp.baseValue + rerolled.statistics.hp.adjustment, value);
  assert.equal(validateBlueprint(rerolled).valid, true);
});

test("locked affinities retain their HP adjustment when rerolling the other defenses", () => {
  const generator = makeGenerator();
  const bp = generator.generate({ ...source, generation: { seed: "rc-affinities-locked" } });
  toggleSectionLock(bp, "defenses.affinities");
  // A genuinely different adjustment makes this a regression for the previous
  // accidental adoption of the newly generated affinity's HP modifier.
  bp.defenses.hpAdjustment = { value: 14, reasons: ["review test"] };
  const rerolled = generator.reroll(bp, { scope: "defenses", seed: "rc-new-defenses" });
  assert.deepEqual(rerolled.defenses, bp.defenses);
  assert.equal(rerolled.statistics.hp.adjustment, 14);
  assert.equal(rerolled.statistics.hp.value, rerolled.statistics.hp.baseValue + 14);
  assert.equal(validateBlueprint(rerolled).valid, true);
});

test("locking HP while rerolling defenses protects its value even when affinities change", () => {
  const generator = makeGenerator();
  const bp = generator.generate({ ...source, generation: { seed: "rc-hp-defenses" } });
  toggleSectionLock(bp, "statistics.hp");
  const original = bp.statistics.hp.value;
  const rerolled = generator.reroll(bp, { scope: "defenses", seed: "rc-hp-defenses-new" });
  assert.equal(rerolled.statistics.hp.value, original);
  assert.equal(rerolled.statistics.hp.adjustment, Number(rerolled.defenses.hpAdjustment?.value ?? 0));
  assert.equal(rerolled.statistics.hp.baseValue + rerolled.statistics.hp.adjustment, original);
  assert.equal(validateBlueprint(rerolled).valid, true);
});

test("locking defense stats leaves defensive affinities independently rerollable", () => {
  const generator = makeGenerator();
  const bp = generator.generate({ ...source, generation: { seed: "rc2-defense-lock" } });
  toggleSectionLock(bp, "defenses");
  assert.equal(canRerollSection(bp, "defenses"), false);
  assert.equal(canRerollSection(bp, "defenses.affinities"), true);

  // Use a sentinel affinity to prove the ability to change that section,
  // independently of the random category's initial affinity distribution.
  bp.defenses.resistances = [{ type: "fire", value: 5 }];
  bp.defenses.hpAdjustment = { value: -10, reasons: [] };
  const before = structuredClone(bp.statistics);
  const rerolled = generator.reroll(bp, { scope: "defenses.affinities", seed: "rc2-affinities" });
  const freshlyGenerated = generator.generate({ ...source, generation: { seed: "rc2-affinities" } });

  for (const key of ["ac", "perception", "saves"]) assert.deepEqual(rerolled.statistics[key], before[key]);
  assert.equal(rerolled.statistics.hp.value, before.hp.value);
  for (const key of ["immunities", "resistances", "weaknesses"]) {
    assert.deepEqual(rerolled.defenses[key], freshlyGenerated.defenses[key]);
  }
  assert.equal(rerolled.statistics.hp.adjustment, rerolled.defenses.hpAdjustment.value);
  assert.equal(rerolled.statistics.hp.baseValue + rerolled.statistics.hp.adjustment, before.hp.value);
  assert.equal(rerolled.locks.defenses, true);
  assert.equal(validateBlueprint(rerolled).valid, true);
  assert.deepEqual(bp.statistics, before, "source blueprint must remain untouched");
});

test("full reroll preserves locked numeric defenses but not unlocked affinities", () => {
  const generator = makeGenerator();
  const bp = generator.generate({ ...source, generation: { seed: "rc2-all-before" } });
  toggleSectionLock(bp, "defenses");
  bp.defenses.resistances = [{ type: "cold", value: 6 }];
  bp.defenses.hpAdjustment = { value: -8, reasons: [] };
  const previousStats = structuredClone(bp.statistics);
  const rerolled = generator.reroll(bp, { scope: "all", seed: "rc2-all-after" });
  const rawNext = generator.generate({ ...source, generation: { seed: "rc2-all-after" } });

  for (const key of ["ac", "perception", "saves"]) assert.deepEqual(rerolled.statistics[key], previousStats[key]);
  assert.equal(rerolled.statistics.hp.value, previousStats.hp.value);
  assert.equal(rerolled.statistics.hp.adjustment, rerolled.defenses.hpAdjustment.value);
  assert.equal(rerolled.statistics.hp.baseValue + rerolled.statistics.hp.adjustment, previousStats.hp.value);
  assert.deepEqual(rerolled.defenses, rawNext.defenses);
  assert.deepEqual(rerolled.identity.resolvedSubtypes, rawNext.identity.resolvedSubtypes);
  assert.deepEqual(rerolled.identity.traits, rawNext.identity.traits);
  assert.equal(validateBlueprint(rerolled).valid, true);
});

test("affinities lock independently protects affinities during defense reroll and full reroll", () => {
  const generator = makeGenerator();
  const bp = generator.generate({ ...source, generation: { seed: "rc2-affinity-lock" } });
  toggleSectionLock(bp, "defenses.affinities");
  bp.defenses.hpAdjustment = { value: 9, reasons: ["test"] };
  assert.equal(canRerollSection(bp, "defenses.affinities"), false);
  assert.equal(canRerollSection(bp, "defenses"), true);
  const parts = generator.reroll(bp, { scope: "defenses", seed: "rc2-reroll-stats" });
  assert.deepEqual(parts.defenses, bp.defenses);
  assert.equal(parts.statistics.hp.adjustment, 9);
  assert.equal(parts.statistics.hp.value, parts.statistics.hp.baseValue + 9);
  const all = generator.reroll(bp, { scope: "all", seed: "rc2-full-restart" });
  assert.deepEqual(all.defenses, bp.defenses);
  assert.equal(all.statistics.hp.adjustment, 9);
  assert.equal(all.statistics.hp.value, all.statistics.hp.baseValue + 9);
  assert.equal(validateBlueprint(parts).valid, true);
  assert.equal(validateBlueprint(all).valid, true);
});

test("simultaneous defense, HP and affinity locks keep both sections without HP drift", () => {
  const generator = makeGenerator();
  const bp = generator.generate({ ...source, generation: { seed: "rc2-both-before" } });
  toggleSectionLock(bp, "defenses");
  toggleSectionLock(bp, "statistics.hp");
  toggleSectionLock(bp, "defenses.affinities");
  const all = generator.reroll(bp, { scope: "all", seed: "rc2-both-after" });
  assert.deepEqual(all.statistics.ac, bp.statistics.ac);
  assert.deepEqual(all.statistics.hp, bp.statistics.hp);
  assert.deepEqual(all.defenses, bp.defenses);
  assert.equal(canRerollSection(all, "defenses.affinities"), false);
  assert.equal(validateBlueprint(all).valid, true);
});

test("UI only disables affinity reroll for its own lock, not for a defense lock", () => {
  const editor = readFileSync(new URL("../scripts/ui/creature-editor.js", import.meta.url), "utf8");
  assert.match(editor, /const rerollBlocked = !canRerollSection\(blueprint, scope\)/);
  assert.match(editor, /if \(this\.capabilities\.generation && canRerollSection\(this\.session\.blueprint, scope\)\)/);
  assert.match(editor, /if \(!canRerollSection\(this\.session\.blueprint, "defenses\.affinities"\)\) return/);
  const bp = makeGenerator().generate(source);
  toggleSectionLock(bp, "defenses");
  assert.equal(canRerollSection(bp, "defenses.affinities"), true);
  toggleSectionLock(bp, "defenses.affinities");
  assert.equal(canRerollSection(bp, "defenses.affinities"), false);
});
