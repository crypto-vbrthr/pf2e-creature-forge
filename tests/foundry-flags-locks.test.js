import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import { compileActorSource, createActorFromBlueprint } from "../scripts/core/compiler.js";
import { LOCKABLE_SECTIONS, canRerollSection, normalizeBlueprintLocks, sectionLocked, sectionLockKey, toggleSectionLock } from "../scripts/core/blueprint-controls.js";

function make() {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  return new CreatureGenerator({ registry });
}

function blueprint(generator, seed = "foundry-flags") {
  return generator.generate({ identity: { level: 8, category: "aberration", role: "brute" }, generation: { seed } });
}

function assertNoDottedKeys(value, where = "flags") {
  if (!value || typeof value !== "object") return;
  for (const [name, child] of Object.entries(value)) {
    assert.ok(!name.includes("."), `Foundry will expand dotted key ${where}.${name}`);
    assertNoDottedKeys(child, `${where}.${name}`);
  }
}

test("NPC flags do not contain conflicting dotted section-lock keys (Foundry 'affinities in false' regression)", () => {
  const generator = make();
  for (const seed of ["unlocked", "defense-locked", "affinities-locked", "both-locked"]) {
    const bp = blueprint(generator, seed);
    if (seed === "defense-locked" || seed === "both-locked") toggleSectionLock(bp, "defenses");
    if (seed === "affinities-locked" || seed === "both-locked") toggleSectionLock(bp, "defenses.affinities");
    for (const scope of ["statistics.hp", "statistics.abilities", "statistics.skills", "combat.attacks"]) toggleSectionLock(bp, scope);
    const actorSource = compileActorSource(bp).actorSource;
    assertNoDottedKeys(actorSource.flags);
    assert.equal(sectionLocked(actorSource.flags["pf2e-creature-forge"].blueprint, "defenses"), sectionLocked(bp, "defenses"));
    assert.equal(sectionLocked(actorSource.flags["pf2e-creature-forge"].blueprint, "defenses.affinities"), sectionLocked(bp, "defenses.affinities"));
  }
});

test("legacy dotted-key preview blueprints compile into Foundry-safe actor flags without modifying the input", () => {
  const bp = blueprint(make(), "legacy-flags");
  bp.locks = { defenses: false, "defenses.affinities": true, "statistics.hp": true, "statistics.skills": false };
  const before = structuredClone(bp);
  const compiled = compileActorSource(bp).actorSource;
  assert.deepEqual(bp, before, "compile must not mutate the generator preview");
  const stored = compiled.flags["pf2e-creature-forge"].blueprint;
  assertNoDottedKeys(stored);
  assert.deepEqual(stored.locks, { defenses: false, defenses_affinities: true, statistics_hp: true, statistics_skills: false });
  assert.equal(sectionLocked(stored, "defenses.affinities"), true);
  assert.equal(canRerollSection(stored, "defenses"), true);
  assert.equal(canRerollSection(stored, "defenses.affinities"), false);
});

test("legacy lock syntax and Foundry-expanded nested legacy locks migrate during section rerolls", () => {
  const generator = make();
  const original = blueprint(generator, "legacy-reroll");
  original.locks = { defenses: true, "defenses.affinities": false, statistics: { hp: true, abilities: true } };
  const legacy = structuredClone(original);
  const rerolled = generator.reroll(original, { scope: "defenses.affinities", seed: "new-affinities" });
  assert.deepEqual(original, legacy);
  assertNoDottedKeys(rerolled.locks);
  assert.equal(sectionLocked(rerolled, "defenses"), true);
  assert.equal(sectionLocked(rerolled, "statistics.hp"), true);
  assert.equal(sectionLocked(rerolled, "statistics.abilities"), true);
  assert.equal(sectionLocked(rerolled, "defenses.affinities"), false);
  assertNoDottedKeys(compileActorSource(rerolled).actorSource.flags);
});

test("all lockable scope identifiers have unique dot-free storage keys", () => {
  const keys = LOCKABLE_SECTIONS.map(sectionLockKey);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.every((key) => !key.includes(".")), true);
  const preview = { locks: Object.fromEntries(LOCKABLE_SECTIONS.map((scope) => [scope, true])) };
  normalizeBlueprintLocks(preview);
  assertNoDottedKeys(preview.locks);
  assert.equal(LOCKABLE_SECTIONS.every((scope) => sectionLocked(preview, scope)), true);
});

test("Actor.create is passed a Foundry-safe source after the editor locks the two defense sections", async () => {
  const bp = blueprint(make(), "create-actor-no-error");
  toggleSectionLock(bp, "defenses");
  toggleSectionLock(bp, "defenses.affinities");
  const original = globalThis.Actor;
  let called = false;
  globalThis.Actor = { create: async (source) => {
    called = true;
    assertNoDottedKeys(source.flags);
    return { uuid: "Actor.test", sheet: { render() {} } };
  } };
  try {
    await createActorFromBlueprint(bp, { renderSheet: false });
    assert.ok(called);
  } finally {
    if (original === undefined) delete globalThis.Actor;
    else globalThis.Actor = original;
  }
});
