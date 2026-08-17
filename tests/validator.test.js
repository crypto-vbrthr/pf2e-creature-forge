import test from "node:test";
import assert from "node:assert/strict";
import { validateBlueprint, validateGenerationRequest } from "../scripts/core/validator.js";
import { createEmptyBlueprint, createGenerationRequest } from "../scripts/core/schemas.js";

test("request validation rejects levels outside the GM Core table range", () => {
  const request = createGenerationRequest({ identity: { level: 25 } });
  const validation = validateGenerationRequest(request);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((entry) => entry.code === "LEVEL_OUT_OF_RANGE"));
});

test("request validation rejects invalid attribute and offense ranks", () => {
  const request = createGenerationRequest({ attributes: { str: "legendary" }, offense: { attack: "absurd", kind: "laser" } });
  const validation = validateGenerationRequest(request);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((entry) => entry.code === "INVALID_ATTRIBUTE_RANK"));
  assert.ok(validation.errors.some((entry) => entry.code === "INVALID_ATTACK_RANK"));
  assert.ok(validation.errors.some((entry) => entry.code === "INVALID_ATTACK_KIND"));
});

test("blueprint validation warns about multiple extreme saves", () => {
  const blueprint = createEmptyBlueprint();
  blueprint.statistics.saves.fortitude.rank = "extreme";
  blueprint.statistics.saves.reflex.rank = "extreme";
  const validation = validateBlueprint(blueprint);
  assert.equal(validation.valid, true);
  assert.ok(validation.warnings.some((entry) => entry.code === "MULTIPLE_EXTREME_SAVES"));
});

test("blueprint validation warns about coupled extreme attack and damage", () => {
  const blueprint = createEmptyBlueprint();
  blueprint.combat.attacks = [{
    id: "attack-1", name: "Doom", profile: "primary", kind: "melee",
    attack: { rank: "extreme", value: 20 }, damage: { rank: "extreme", formula: "2d12+15", average: 28, type: "slashing" }, traits: []
  }];
  const validation = validateBlueprint(blueprint);
  assert.equal(validation.valid, true);
  assert.ok(validation.warnings.some((entry) => entry.code === "COUPLED_EXTREME_ATTACK_DAMAGE"));
});

test("request validation rejects invalid movement and sense settings", () => {
  const request = createGenerationRequest({
    movement: { fly: 500 },
    senses: { darkvision: "sometimes", scentRange: 500 }
  });
  const validation = validateGenerationRequest(request);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((entry) => entry.code === "INVALID_SPEED"));
  assert.ok(validation.errors.some((entry) => entry.code === "INVALID_SENSE_SETTING"));
  assert.ok(validation.errors.some((entry) => entry.code === "INVALID_SENSE_RANGE"));
});

test("blueprint validation detects malformed skills, movement, and senses", () => {
  const blueprint = createEmptyBlueprint();
  blueprint.statistics.skills = { mystery: { slug: "mystery", rank: "legendary", value: "many" } };
  blueprint.statistics.speed.other = [{ type: "teleport", value: -5 }];
  blueprint.statistics.senses = [{ type: "scent", acuity: "imprecise", range: 0 }];
  const validation = validateBlueprint(blueprint);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((entry) => entry.code === "INVALID_SKILL"));
  assert.ok(validation.errors.some((entry) => entry.code === "INVALID_OTHER_SPEED"));
  assert.ok(validation.errors.some((entry) => entry.code === "INVALID_SENSE_RANGE"));
});

test("request validation warns when a registered subtype is used with an incompatible category", async () => {
  const { ContentRegistry } = await import("../scripts/core/registry.js");
  const { registerCoreContent } = await import("../scripts/core/core-content.js");
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  const request = createGenerationRequest({ identity: { category: "animal", subtypes: ["devil"] } });
  const validation = validateGenerationRequest(request, { registry });
  assert.equal(validation.valid, true);
  assert.ok(validation.warnings.some((entry) => entry.code === "INCOMPATIBLE_SUBTYPE"));
});

test("blueprint validation warns about broad resistance without defensive HP tradeoff", () => {
  const blueprint = createEmptyBlueprint();
  blueprint.defenses.resistances = [{ type: "physical", value: 5 }];
  blueprint.defenses.hpAdjustment = { value: 0, reasons: [] };
  const validation = validateBlueprint(blueprint);
  assert.ok(validation.warnings.some((entry) => entry.code === "BROAD_RESISTANCE_WITHOUT_HP_TRADEOFF"));
});

test("request validation rejects invalid spellcasting configuration", () => {
  const invalid = createGenerationRequest({
    identity: { level: 10, role: "spellcaster", category: "humanoid" },
    spellcasting: { mode: "required", style: "scrollmancer", tradition: "chaos", dcRank: "legendary", highestRank: 11, breadth: "enormous" }
  });
  // createGenerationRequest normalizes unsupported enum values back to safe defaults,
  // so validate a deliberately malformed request object to exercise the contract.
  invalid.spellcasting = { mode: "maybe", style: "scrollmancer", tradition: "chaos", dcRank: "legendary", highestRank: 11, breadth: "enormous", themes: [] };
  const result = validateGenerationRequest(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.path === "spellcasting.mode"));
  assert.ok(result.errors.some((entry) => entry.path === "spellcasting.style"));
  assert.ok(result.errors.some((entry) => entry.path === "spellcasting.tradition"));
  assert.ok(result.errors.some((entry) => entry.path === "spellcasting.highestRank"));
});

test("legacy options.spellcasting alias still controls spellcasting mode when no first-class mode is supplied", () => {
  assert.equal(createGenerationRequest({ options: { spellcasting: "off" } }).spellcasting.mode, "none");
  assert.equal(createGenerationRequest({ options: { spellcasting: "on" } }).spellcasting.mode, "required");
  assert.equal(createGenerationRequest({ spellcasting: { mode: "auto" }, options: { spellcasting: "off" } }).spellcasting.mode, "auto");
});


test("blueprint validation rejects duplicate runtime ids and malformed identity data", () => {
  const blueprint = createEmptyBlueprint();
  blueprint.identity.level = 25;
  blueprint.identity.size = "colossal";
  blueprint.combat.attacks = [
    { id: "dup", name: "A", kind: "melee", attack: { rank: "high", value: 10 }, damage: { rank: "moderate", formula: "1d6+2", average: 5.5, type: "slashing" }, traits: [] },
    { id: "dup", name: "B", kind: "melee", attack: { rank: "moderate", value: 8 }, damage: { rank: "high", formula: "1d8+4", average: 8.5, type: "slashing" }, traits: [] }
  ];
  blueprint.combat.spellcasting = [{
    id: "casting", tradition: "arcane", style: "prepared", dc: 20, attack: 12, highestRank: 2, powerCost: 1,
    spells: [
      { id: "spell-x", sourceUuid: "Compendium.test.Item.a", baseRank: 1, rank: 1, cantrip: false },
      { id: "spell-x", sourceUuid: "Compendium.test.Item.b", baseRank: 1, rank: 1, cantrip: false }
    ]
  }];
  const validation = validateBlueprint(blueprint);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((entry) => entry.code === "BLUEPRINT_LEVEL_OUT_OF_RANGE"));
  assert.ok(validation.errors.some((entry) => entry.code === "INVALID_BLUEPRINT_SIZE"));
  assert.ok(validation.errors.some((entry) => entry.code === "DUPLICATE_ATTACK_ID"));
  assert.ok(validation.errors.some((entry) => entry.code === "DUPLICATE_SPELL_ID"));
});

test("blueprint validation warns when hosted Affliction delivery points to a missing carrier", () => {
  const blueprint = createEmptyBlueprint();
  blueprint.resources.afflictions = [{
    id: "affliction-1",
    definition: { name: "Test", afflictionType: "poison", stages: [{ number: 1, name: "Stage 1" }] },
    delivery: { mode: "hosted", hostType: "attack", hostId: "missing-attack", trigger: "on-hit", application: "automatic" }
  }];
  const validation = validateBlueprint(blueprint);
  assert.equal(validation.valid, true);
  assert.ok(validation.warnings.some((entry) => entry.code === "AFFLICTION_DELIVERY_HOST_MISSING"));
});
