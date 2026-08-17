import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { createGenerationRequest } from "../scripts/core/schemas.js";
import { SeededRandom } from "../scripts/core/rng.js";
import {
  estimateSpellcastingPower,
  generateSpellcasting,
  highestSpellRankForLevel,
  rerollSpellSlot,
  spellcastingChance
} from "../scripts/core/spellcasting.js";

function spell(id, level, { themes = [], traditions = ["arcane"], cantrip = false } = {}) {
  return {
    id: `pf2e.spells-srd:${id}`,
    sourceUuid: `Compendium.pf2e.spells-srd.Item.${id}`,
    compendiumId: "pf2e.spells-srd",
    name: id,
    img: `${id}.webp`,
    slug: id,
    level,
    traits: cantrip ? ["cantrip", ...themes] : [...themes],
    traditions,
    rarity: "common",
    ritual: false,
    cantrip,
    focus: false,
    area: themes.includes("area") ? { type: "burst", value: 20 } : null,
    defense: themes.includes("control") ? { save: { statistic: "will" } } : null,
    themes: [...new Set(themes)],
    source: { sourceKind: "compendium", compendiumId: "pf2e.spells-srd" }
  };
}

function pool() {
  return [
    spell("fireball", 3, { themes: ["fire", "area"], traditions: ["arcane", "primal"] }),
    spell("flame-wall", 4, { themes: ["fire", "control"], traditions: ["arcane", "primal"] }),
    spell("burning-hands", 1, { themes: ["fire", "area"], traditions: ["arcane", "primal"] }),
    spell("frost", 1, { themes: ["cold"], traditions: ["arcane", "primal"] }),
    spell("shield", 1, { themes: ["protection"], traditions: ["arcane"] }),
    spell("slow", 3, { themes: ["control"], traditions: ["arcane", "occult"] }),
    spell("blink", 4, { themes: ["movement"], traditions: ["arcane", "occult"] }),
    spell("force", 2, { themes: ["force"], traditions: ["arcane"] }),
    spell("detect-magic", 0, { themes: ["utility"], traditions: ["arcane", "divine", "occult", "primal"], cantrip: true }),
    spell("ignition", 0, { themes: ["fire", "attack-roll"], traditions: ["arcane", "primal"], cantrip: true }),
    spell("daze", 0, { themes: ["mental"], traditions: ["arcane", "divine", "occult"], cantrip: true })
  ];
}

function setup() {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  const spells = pool();
  const spellSources = { listSpells: () => spells.map((entry) => structuredClone(entry)) };
  return { registry, spellSources };
}

test("spellcasting uses GM Core DC/attack bands and level-appropriate ranks", () => {
  const { registry, spellSources } = setup();
  const request = createGenerationRequest({
    identity: { level: 10, role: "spellcaster", category: "dragon", subtypes: ["fire"] },
    spellcasting: { mode: "required", style: "prepared", tradition: "arcane", dcRank: "high", breadth: "standard" },
    sources: { spells: ["pf2e.spells-srd"] }
  });
  const result = generateSpellcasting({
    request, registry, spellSources, level: 10, roleId: "spellcaster", category: "dragon", subtypes: ["fire"],
    random: new SeededRandom("spellcaster-core"), availableBudget: 3
  });
  const entry = result.spellcasting[0];
  assert.ok(entry);
  assert.equal(entry.dc, 29);
  assert.equal(entry.attack, 21);
  assert.equal(entry.highestRank, 5);
  assert.equal(entry.powerCost, 3);
  assert.equal(result.spent, 3);
  assert.ok(entry.spells.some((candidate) => candidate.cantrip));
  assert.ok(entry.spells.every((candidate) => candidate.cantrip || candidate.rank <= 5));
});

test("automatic spellcasting remains optional and concept-sensitive", () => {
  const mundane = createGenerationRequest({ identity: { level: 5, role: "brute", category: "animal" } });
  const caster = createGenerationRequest({ identity: { level: 5, role: "spellcaster", category: "fey" } });
  assert.equal(spellcastingChance({ request: mundane, category: "animal", subtypes: [], roleId: "brute" }), 0);
  assert.ok(spellcastingChance({ request: caster, category: "fey", subtypes: [], roleId: "spellcaster" }) > 0.9);
});

test("auto tradition selection only chooses traditions actually present in active spell sources", () => {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  const primalOnly = [
    spell("primal-fire", 2, { themes: ["fire"], traditions: ["primal"] }),
    spell("primal-cantrip", 0, { themes: ["fire"], traditions: ["primal"], cantrip: true })
  ];
  const request = createGenerationRequest({
    identity: { level: 6, role: "magicalStriker", category: "dragon", subtypes: ["fire"] },
    spellcasting: { mode: "required", tradition: "auto", style: "innate", breadth: "focused" }
  });
  const result = generateSpellcasting({
    request, registry, spellSources: { listSpells: () => primalOnly }, level: 6, roleId: "magicalStriker", category: "dragon", subtypes: ["fire"],
    random: new SeededRandom("available-tradition"), availableBudget: 10
  });
  assert.equal(result.spellcasting[0]?.tradition, "primal");
});

test("thematic weighting favors concept-matching spells over generic alternatives across deterministic seeds", () => {
  const { registry, spellSources } = setup();
  const request = createGenerationRequest({
    identity: { level: 10, role: "spellcaster", category: "dragon", subtypes: ["fire"] },
    spellcasting: { mode: "required", tradition: "arcane", style: "innate", breadth: "focused" }
  });
  let fire = 0;
  let nonFire = 0;
  for (let index = 0; index < 24; index += 1) {
    const result = generateSpellcasting({
      request, registry, spellSources, level: 10, roleId: "spellcaster", category: "dragon", subtypes: ["fire"],
      random: new SeededRandom(`theme-${index}`), availableBudget: 10
    });
    for (const selected of result.spellcasting[0]?.spells ?? []) {
      if (selected.themes.includes("fire")) fire += 1;
      else nonFire += 1;
    }
  }
  assert.ok(fire > nonFire, `expected fire-themed selection to dominate (${fire} vs ${nonFire})`);
});

test("innate spells get per-day uses while cantrips stay at-will", () => {
  const { registry, spellSources } = setup();
  const request = createGenerationRequest({
    identity: { level: 8, role: "magicalStriker", category: "dragon", subtypes: ["fire"] },
    spellcasting: { mode: "required", tradition: "arcane", style: "innate", breadth: "focused" }
  });
  const result = generateSpellcasting({
    request, registry, spellSources, level: 8, roleId: "magicalStriker", category: "dragon", subtypes: ["fire"],
    random: new SeededRandom("innate-uses"), availableBudget: 10
  });
  for (const selected of result.spellcasting[0].spells) {
    assert.equal(selected.uses, selected.cantrip ? null : 1);
  }
});

test("single spell reroll excludes the previous spell and preserves all unrelated spell slots", () => {
  const { registry, spellSources } = setup();
  const request = createGenerationRequest({
    identity: { level: 10, role: "spellcaster", category: "dragon", subtypes: ["fire"] },
    spellcasting: { mode: "required", tradition: "arcane", style: "prepared", breadth: "standard" }
  });
  const initial = generateSpellcasting({
    request, registry, spellSources, level: 10, roleId: "spellcaster", category: "dragon", subtypes: ["fire"],
    random: new SeededRandom("reroll-initial"), availableBudget: 10
  }).spellcasting[0];
  assert.ok(initial.spells.length >= 3);
  const target = initial.spells[1];
  const blueprint = {
    identity: { level: 10, role: "spellcaster", category: "dragon", subtypes: ["fire"], resolvedSubtypes: ["fire"] },
    combat: { spellcasting: [structuredClone(initial)] },
    resources: { auras: [], afflictions: [] },
    metadata: { abilityBudget: { spent: 0 }, specialFeatureBudget: { limit: 10 } }
  };
  const rerolled = rerollSpellSlot({ request, registry, spellSources, blueprint, targetId: target.id, random: new SeededRandom("reroll-new") }).spellcasting[0];
  assert.ok(rerolled);
  assert.notEqual(rerolled.spells[1].sourceUuid, target.sourceUuid);
  for (let index = 0; index < initial.spells.length; index += 1) {
    if (index === 1) continue;
    assert.equal(rerolled.spells[index].sourceUuid, initial.spells[index].sourceUuid);
  }
});

test("spell rank and power helpers stay bounded", () => {
  assert.equal(highestSpellRankForLevel(-1), 1);
  assert.equal(highestSpellRankForLevel(1), 1);
  assert.equal(highestSpellRankForLevel(10), 5);
  assert.equal(highestSpellRankForLevel(20), 10);
  assert.equal(highestSpellRankForLevel(24), 10);
  assert.equal(estimateSpellcastingPower({ enabled: true, breadth: "focused", style: "innate", dcRank: "moderate" }), 2);
  assert.equal(estimateSpellcastingPower({ enabled: true, breadth: "standard", style: "prepared", dcRank: "high" }), 3);
  assert.equal(estimateSpellcastingPower({ enabled: true, breadth: "broad", style: "spontaneous", dcRank: "extreme" }), 5);
});

test("spellcasting participates in the shared creature power budget before optional abilities", async () => {
  const { CreatureGenerator } = await import("../scripts/core/generator.js");
  const { registry, spellSources } = setup();
  const generator = new CreatureGenerator({ registry, spellSources });
  const blueprint = generator.generate({
    identity: { level: 10, role: "spellcaster", category: "humanoid" },
    spellcasting: { mode: "required", tradition: "arcane", style: "prepared", breadth: "standard" },
    specialFeatures: { frequency: "normal", auras: { mode: "none" }, afflictions: { mode: "none" } },
    generation: { seed: "shared-spell-budget" }
  });
  assert.equal(blueprint.combat.spellcasting.length, 1);
  assert.equal(blueprint.metadata.specialFeatureBudget.spellcastingSpent, 3);
  assert.ok(blueprint.metadata.specialFeatureBudget.spent <= blueprint.metadata.specialFeatureBudget.limit);
  assert.equal(blueprint.metadata.specialFeatureBudget.remaining, 0);
  assert.equal(blueprint.abilities.length, 0, "primary spellcasting should consume the spellcaster role's default special budget instead of being free extra power");
  assert.ok(!blueprint.diagnostics.some((entry) => entry.code === "SPECIAL_POWER_BUDGET_STALE"));
});


test("spellcaster can keep required standard spellcasting and an explicitly required affliction over budget", async () => {
  const { CreatureGenerator } = await import("../scripts/core/generator.js");
  const { registry, spellSources } = setup();
  const generator = new CreatureGenerator({ registry, spellSources });
  const blueprint = generator.generate({
    identity: { level: 10, role: "spellcaster", category: "undead" },
    spellcasting: { mode: "required", tradition: "arcane", style: "prepared", breadth: "standard" },
    specialFeatures: { frequency: "normal", auras: { mode: "none" }, afflictions: { mode: "required" } },
    abilities: { mode: "off" },
    generation: { seed: "required-spellcasting-plus-affliction" }
  });
  assert.equal(blueprint.combat.spellcasting.length, 1);
  assert.equal(blueprint.resources.afflictions.length, 1);
  assert.equal(blueprint.metadata.specialFeatureBudget.limit, 3);
  assert.equal(blueprint.metadata.specialFeatureBudget.spellcastingSpent, 3);
  assert.ok(blueprint.metadata.specialFeatureBudget.afflictionSpent > 0);
  assert.ok(blueprint.metadata.specialFeatureBudget.spent > blueprint.metadata.specialFeatureBudget.limit);
  assert.ok(blueprint.diagnostics.some((entry) => entry.code === "REQUIRED_AFFLICTION_OVER_BUDGET"));
  assert.ok(blueprint.diagnostics.some((entry) => entry.code === "SPECIAL_POWER_BUDGET_EXCEEDED"));
});
