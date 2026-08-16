import test from "node:test";
import assert from "node:assert/strict";
import { SeededRandom } from "../scripts/core/rng.js";

test("seeded RNG reproduces the same stream", () => {
  const a = new SeededRandom("same-seed");
  const b = new SeededRandom("same-seed");
  assert.deepEqual(
    Array.from({ length: 8 }, () => a.int(1, 1000)),
    Array.from({ length: 8 }, () => b.int(1, 1000))
  );
});

test("forked streams are stable and isolated by label", () => {
  const hpA = new SeededRandom("root").fork("hp");
  const hpB = new SeededRandom("root").fork("hp");
  const ac = new SeededRandom("root").fork("ac");
  const hpValuesA = Array.from({ length: 5 }, () => hpA.int(1, 100));
  const hpValuesB = Array.from({ length: 5 }, () => hpB.int(1, 100));
  const acValues = Array.from({ length: 5 }, () => ac.int(1, 100));
  assert.deepEqual(hpValuesA, hpValuesB);
  assert.notDeepEqual(hpValuesA, acValues);
});

test("weighted selection obeys zero-weight exclusions", () => {
  const rng = new SeededRandom("weighted");
  for (let i = 0; i < 20; i += 1) {
    assert.equal(rng.weightedPick([{ value: "never", weight: 0 }, { value: "always", weight: 1 }]), "always");
  }
});
