import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import { ROLE_IDS } from "../scripts/core/role-presets.js";
import { validateBlueprint } from "../scripts/core/validator.js";

test("review matrix keeps boundary-level core category/role generations structurally valid", () => {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  const generator = new CreatureGenerator({ registry });
  const categories = registry.list("category").map((entry) => entry.slug);
  let cases = 0;
  for (const level of [-1, 10, 24]) {
    for (const role of ROLE_IDS) {
      for (const category of categories) {
        const blueprint = generator.generate({
          identity: { level, role, category },
          spellcasting: { mode: "none" },
          generation: { seed: `review:${level}:${role}:${category}` }
        });
        const validation = validateBlueprint(blueprint);
        assert.equal(validation.valid, true, `${level}/${role}/${category}: ${validation.errors.map((entry) => entry.code).join(", ")}`);
        cases += 1;
      }
    }
  }
  assert.ok(cases >= 400);
});
