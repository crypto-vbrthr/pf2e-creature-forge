import test from "node:test";
import assert from "node:assert/strict";
import { CORE_AURAS, CORE_AFFLICTIONS } from "../scripts/core/core-special-features.js";
import { localizeAuraResourceDefinition, localizeAfflictionResourceDefinition } from "../scripts/special-feature-localization.js";

function withGerman(fn) {
  const previous = globalThis.game;
  globalThis.game = { i18n: { lang: "de", localize: (key) => key, format: (key) => key }, settings: { get: () => "de" } };
  try { return fn(); } finally { globalThis.game = previous; }
}

test("core Aura nested labels localize before embedded editing/runtime", () => withGerman(() => {
  const resource = CORE_AURAS.find((entry) => entry.slug === "dread-presence");
  const definition = localizeAuraResourceDefinition(resource);
  assert.equal(definition.name, "Furchterregende Gegenwart");
  assert.equal(definition.triggers[0].name, "Furchterregende Gegenwart");
  assert.equal(definition.triggers[0].outcomes.failure.name, "Verängstigt");
}));

test("core Affliction stages localize without overwriting the neutral stored definition", () => withGerman(() => {
  const resource = CORE_AFFLICTIONS.find((entry) => entry.slug === "predator-venom");
  const definition = localizeAfflictionResourceDefinition(resource);
  assert.equal(definition.name, "Raubtiergift");
  assert.equal(definition.stages[0].name, "Phase 1");
  assert.equal(definition.stages[0].description, "Das Gift schwächt das Opfer.");
  assert.equal(definition.stages[0].effect.name, "Raubtiergift");
  assert.equal(resource.definition.stages[0].name, "Stage 1");
}));
