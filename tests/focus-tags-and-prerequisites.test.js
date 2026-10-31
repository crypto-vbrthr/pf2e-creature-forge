import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ABILITY_FOCUS_GROUPS, COMMON_ABILITY_FOCUS_TAGS, additionalAbilityFocus, normalizeAbilityFocus } from "../scripts/core/ability-focus-tags.js";
import { ensureAbilityRequiredSkills, getAbilityRequiredSkills } from "../scripts/core/ability-skill-prerequisites.js";
import { ContentRegistry } from "../scripts/core/registry.js";
import { generateAbilities } from "../scripts/core/ability-engine.js";
import { SeededRandom } from "../scripts/core/rng.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";

const request = ({ focus = [], attackKind = "melee" } = {}) => ({
  identity: { category: "humanoid", level: 5, role: "custom", subtypes: [] },
  abilities: { mode: "auto", count: 1, complexity: "standard", powerBudget: 12, focus },
  offense: { kind: attackKind },
  sources: { abilities: [] }
});

test("curated checkbox focus tags and free-form addon tags share a stable request model", () => {
  assert.ok(ABILITY_FOCUS_GROUPS.length >= 3);
  assert.equal(new Set(COMMON_ABILITY_FOCUS_TAGS).size, COMMON_ABILITY_FOCUS_TAGS.length);
  assert.deepEqual(normalizeAbilityFocus(["Control", " fear ", "control", "my-addon"]), ["control", "fear", "my-addon"]);
  assert.deepEqual(additionalAbilityFocus(["control", "my-addon", "terrain", "OTHER"]), ["my-addon", "other"]);
  const ui = readFileSync(new URL("../scripts/ui/creature-editor.js", import.meta.url), "utf8");
  assert.match(ui, /input type="checkbox" name="abilityFocusChoice"/);
  assert.match(ui, /class="cf-focus-indicator" aria-hidden="true"/);
  assert.match(ui, /class="cf-focus-name"/);
  const style = readFileSync(new URL("../styles/creature-forge.css", import.meta.url), "utf8");
  assert.match(style, /label\.cf-focus-choice input\[type="checkbox"\] \{/);
  assert.match(style, /clip-path: inset\(50%\)/);
  assert.match(style, /input:checked \+ \.cf-focus-indicator/);
  assert.match(style, /:focus-within/);
  // Reproduces the visual bug in 1.2.1: a one-time "is-selected" class
  // survived subsequent uncheck events because focus changes do not rerender.
  // The chip must derive its appearance entirely from the live input state.
  assert.match(style, /label\.cf-focus-choice:has\(input:checked\)/);
  assert.doesNotMatch(style, /label\.cf-focus-choice\.is-selected/);
  assert.match(ui, /<label class="cf-focus-choice">/);
  assert.doesNotMatch(ui, /<label class="cf-focus-choice\$\{/);
  assert.match(ui, /root\.querySelectorAll\('input\[name="abilityFocusChoice"\]:checked'\)/);
  assert.match(ui, /additionalAbilityFocus\(request\.abilities\.focus/);
});

test("focus tags increase score by 20 but do not filter unrelated eligible abilities", () => {
  const registry = new ContentRegistry();
  const mk = (slug, tags) => ({ id: `test.focus.${slug}`, slug, tags, abilityType: "action", powerCost: 1, baseWeight: 40 });
  registry.register("ability", mk("with", ["control"]));
  registry.register("ability", mk("without", ["support"]));
  let observed = [];
  const random = { fork: () => ({ weightedPick: (entries) => {
    observed = entries;
    return entries[0].value;
  } }) };
  generateAbilities({ request: request({ focus: ["control"] }), registry, level: 5, roleId: "custom", category: "humanoid", subtypes: [], random });
  assert.equal(observed.find((entry) => entry.value.id.endsWith(".with")).weight, 60);
  assert.equal(observed.find((entry) => entry.value.id.endsWith(".without")).weight, 40);
});

test("explicit melee tag requires a melee profile; standalone ranged effects remain usable", () => {
  const registry = new ContentRegistry();
  for (const kind of ["melee", "ranged"]) registry.register("ability", {
    id: `test.profile.${kind}`, slug: kind, tags: [kind], abilityType: "action", powerCost: 1, baseWeight: 1
  });
  const run = (attacks) => generateAbilities({ request: request(), registry, level: 5, roleId: "custom", category: "humanoid", subtypes: [], random: new SeededRandom("attack-kind"), attacks });
  assert.equal(run([{ kind: "ranged" }]).abilities[0].contentId, "test.profile.ranged");
  assert.equal(run([{ kind: "melee" }]).abilities.length, 1);
  assert.ok(!run([]).abilities.some((entry) => entry.contentId === "test.profile.melee"));
});

test("explicit skill tags and skill-check interactions add usable skills without overwriting generated ones", () => {
  assert.deepEqual(getAbilityRequiredSkills([{ interactions: [{ kind: "check", statistic: "athletics" }] }, { tags: ["deception", "fear"] }]), ["athletics", "deception"]);
  const skills = { athletics: { slug: "athletics", value: 42, rank: "extreme", locked: true } };
  const result = ensureAbilityRequiredSkills(skills, [{ tags: ["athletics", "stealth"] }], 6, new SeededRandom("skill-check"));
  assert.strictEqual(result.athletics, skills.athletics);
  assert.equal(result.stealth.rank, "moderate");
  assert.equal(result.stealth.attribute, "dex");
  assert.equal(result.stealth.generatedForAbility, true);
  assert.ok(Number.isFinite(result.stealth.value));
  assert.equal(skills.stealth, undefined);
});

test("core integrates addon abilities requiring skills during full generation and reroll", () => {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  registry.register("ability", {
    id: "test.skill.athletics-interaction", slug: "athletics-interaction", powerCost: 1, baseWeight: 99999999,
    selection: { categories: ["humanoid"] }, tags: ["athletics"],
    interactions: [{ kind: "check", statistic: "athletics", defense: "fortitude" }]
  });
  const generator = new CreatureGenerator({ registry });
  const input = {
    identity: { category: "humanoid", role: "custom", level: 5 },
    skills: { count: 0 },
    abilities: { mode: "auto", count: 1, powerBudget: 9 },
    generation: { seed: "forced-athletics" }
  };
  const generated = generator.generate(input);
  assert.equal(generated.abilities[0].contentId, "test.skill.athletics-interaction");
  assert.ok(generated.statistics.skills.athletics);
  assert.equal(generated.statistics.skills.athletics.rank, "moderate");
  const rerolled = generator.reroll(generated, { scope: "abilities", seed: "forced-athletics-reroll" });
  assert.ok(rerolled.statistics.skills.athletics);
});
