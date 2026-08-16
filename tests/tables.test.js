import test from "node:test";
import assert from "node:assert/strict";
import { AC_TABLE, PERCEPTION_TABLE, SAVE_TABLE, resolveHpRange, resolveRankValue } from "../scripts/core/tables.js";

test("GM Core AC table resolves representative levels", () => {
  assert.equal(resolveRankValue(AC_TABLE, -1, "extreme"), 18);
  assert.equal(resolveRankValue(AC_TABLE, 10, "high"), 30);
  assert.equal(resolveRankValue(AC_TABLE, 24, "moderate"), 50);
});

test("GM Core save/perception table resolves representative levels", () => {
  assert.equal(resolveRankValue(SAVE_TABLE, 10, "extreme"), 24);
  assert.equal(resolveRankValue(SAVE_TABLE, 10, "terrible"), 14);
  assert.equal(resolveRankValue(PERCEPTION_TABLE, 24, "high"), 42);
});

test("GM Core HP table preserves ranges", () => {
  assert.deepEqual(resolveHpRange(-1, "moderate"), { min: 7, max: 8 });
  assert.deepEqual(resolveHpRange(10, "high"), { min: 215, max: 223 });
  assert.deepEqual(resolveHpRange(24, "low"), { min: 367, max: 383 });
});
