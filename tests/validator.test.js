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
