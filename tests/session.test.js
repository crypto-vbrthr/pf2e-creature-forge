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
