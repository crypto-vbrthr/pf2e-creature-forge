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

test("blueprint validation warns about multiple extreme saves", () => {
  const blueprint = createEmptyBlueprint();
  blueprint.statistics.saves.fortitude.rank = "extreme";
  blueprint.statistics.saves.reflex.rank = "extreme";
  const validation = validateBlueprint(blueprint);
  assert.equal(validation.valid, true);
  assert.ok(validation.warnings.some((entry) => entry.code === "MULTIPLE_EXTREME_SAVES"));
});
