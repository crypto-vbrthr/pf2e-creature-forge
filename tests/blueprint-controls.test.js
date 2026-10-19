import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import { validateBlueprint } from "../scripts/core/validator.js";
import { compileActorSource } from "../scripts/core/compiler.js";
import { toggleSectionLock, sectionLocked, adjustPreviewNumber, LOCKABLE_SECTIONS } from "../scripts/core/blueprint-controls.js";

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
  assert.equal(next.locks["statistics.abilities"], true);
  assert.equal(next.metadata.requestSnapshot.identity.name, "Changed");
});
