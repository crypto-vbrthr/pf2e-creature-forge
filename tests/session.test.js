import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import { createGenerationRequest } from "../scripts/core/schemas.js";
import { validateBlueprint, validateGenerationRequest } from "../scripts/core/validator.js";
import { CreatureEditorSession } from "../scripts/ui/editor-session.js";

function api() {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  const generator = new CreatureGenerator({ registry });
  return {
    createRequest: createGenerationRequest,
    generate: (request) => generator.generate(request),
    reroll: (bp, options) => generator.reroll(bp, options),
    validateRequest: (request) => validateGenerationRequest(createGenerationRequest(request), { registry }),
    validate: validateBlueprint
  };
}

test("editor session owns draft state without persistence", () => {
  const session = new CreatureEditorSession({ api: api(), request: { identity: { level: 3, category: "undead" }, generation: { seed: "editor" } } });
  assert.equal(session.dirty, false);
  const blueprint = session.generate();
  assert.equal(blueprint.identity.level, 3);
  assert.equal(session.dirty, true);
  session.markClean();
  assert.equal(session.dirty, false);
});

test("embedded editor session rehydrates persisted blueprint request state", () => {
  const generatorApi = api();
  const originalRequest = createGenerationRequest({
    identity: { level: 11, role: "spellcaster", category: "dragon", subtypes: ["fire"], size: "huge" },
    mythic: { enabled: true, role: "caster" },
    sources: { abilities: ["pf2e-creature-forge.ability-library.core"], spells: ["pf2e.spells-srd"] },
    generation: { seed: "persisted-editor" }
  });
  const blueprint = generatorApi.generate(originalRequest);
  const session = new CreatureEditorSession({ api: generatorApi, blueprint, mode: "edit" });

  assert.equal(session.request.identity.level, 11);
  assert.equal(session.request.identity.category, "dragon");
  assert.deepEqual(session.request.identity.subtypes, ["fire"]);
  assert.equal(session.request.mythic.enabled, true);
  assert.equal(session.request.mythic.role, "caster");
  assert.deepEqual(session.request.sources.spells, ["pf2e.spells-srd"]);
  assert.equal(session.request.generation.seed, "persisted-editor");
  assert.equal(session.dirty, false);
});

test("persisted pre-mythic request snapshots normalize safely in the editor", () => {
  const generatorApi = api();
  const blueprint = generatorApi.generate({ identity: { level: 5, category: "undead" }, generation: { seed: "legacy-editor" } });
  delete blueprint.metadata.requestSnapshot.mythic;
  blueprint.metadata.requestSnapshot.schemaVersion = 7;
  blueprint.schemaVersion = 10;

  const session = new CreatureEditorSession({ api: generatorApi, blueprint, mode: "edit" });
  assert.equal(session.request.schemaVersion, 8);
  assert.equal(session.request.identity.level, 5);
  assert.equal(session.request.identity.category, "undead");
  assert.equal(session.request.mythic.enabled, false);
  assert.equal(session.request.mythic.role, "auto");
  assert.equal(session.validate().blueprint.valid, true);
});
