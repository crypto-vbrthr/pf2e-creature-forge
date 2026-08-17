import test from "node:test";
import assert from "node:assert/strict";
import {
  AC_TABLE, ATTACK_TABLE, PERCEPTION_TABLE, SAVE_TABLE, SPELL_ATTACK_TABLE, SPELL_DC_TABLE,
  resolveAttackDamage, resolveAttributeValue, resolveHpRange, resolveRankValue, resolveSkillValue
} from "../scripts/core/tables.js";

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

test("GM Core ability modifier table resolves representative values", () => {
  assert.equal(resolveAttributeValue(1, "high"), 4);
  assert.equal(resolveAttributeValue(10, "moderate"), 5);
  assert.equal(resolveAttributeValue(24, "extreme"), 13);
  assert.equal(resolveAttributeValue(12, "terrible"), -5);
});

test("GM Core attack bonus table resolves representative values", () => {
  assert.equal(resolveRankValue(ATTACK_TABLE, -1, "high"), 8);
  assert.equal(resolveRankValue(ATTACK_TABLE, 10, "moderate"), 21);
  assert.equal(resolveRankValue(ATTACK_TABLE, 24, "extreme"), 46);
});

test("GM Core attack damage table resolves formula and average", () => {
  assert.deepEqual(resolveAttackDamage(1, "high"), { formula: "1d6+3", average: 6 });
  assert.deepEqual(resolveAttackDamage(10, "extreme"), { formula: "2d12+20", average: 33 });
  assert.deepEqual(resolveAttackDamage(24, "low"), { formula: "4d6+21", average: 35 });
});


test("GM Core skill table resolves fixed and low-range values", () => {
  assert.equal(resolveSkillValue(-1, "extreme"), 8);
  assert.equal(resolveSkillValue(10, "high"), 22);
  assert.equal(resolveSkillValue(24, "moderate"), 40);
  assert.equal(resolveSkillValue(10, "low", { int: (min, max) => max }), 17);
});


test("GM Core spell DC and spell attack tables resolve representative values", () => {
  assert.equal(resolveRankValue(SPELL_DC_TABLE, 10, "extreme"), 33);
  assert.equal(resolveRankValue(SPELL_ATTACK_TABLE, 10, "extreme"), 25);
  assert.equal(resolveRankValue(SPELL_DC_TABLE, 10, "high"), 29);
  assert.equal(resolveRankValue(SPELL_ATTACK_TABLE, 10, "high"), 21);
  assert.equal(resolveRankValue(SPELL_DC_TABLE, 10, "moderate"), 26);
  assert.equal(resolveRankValue(SPELL_ATTACK_TABLE, 10, "moderate"), 18);
});
