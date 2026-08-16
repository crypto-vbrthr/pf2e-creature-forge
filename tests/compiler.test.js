import test from "node:test";
import assert from "node:assert/strict";
import { ContentRegistry } from "../scripts/core/registry.js";
import { registerCoreContent } from "../scripts/core/core-content.js";
import { CreatureGenerator } from "../scripts/core/generator.js";
import { compileActorSource } from "../scripts/core/compiler.js";

test("compiler creates a PF2E NPC source with blueprint provenance", () => {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  const generator = new CreatureGenerator({ registry });
  const blueprint = generator.generate({
    identity: { name: "Forge Test", level: 4, role: "skirmisher", category: "animal", subtypes: ["aquatic"], size: "med" },
    generation: { seed: "compile" }
  });
  const compiled = compileActorSource(blueprint);
  assert.equal(compiled.actorSource.type, "npc");
  assert.equal(compiled.actorSource.name, "Forge Test");
  assert.equal(compiled.actorSource.system.details.level.value, 4);
  assert.equal(compiled.actorSource.system.attributes.ac.value, blueprint.statistics.ac.value);
  assert.equal(compiled.actorSource.system.attributes.hp.max, blueprint.statistics.hp.value);
  assert.deepEqual(compiled.actorSource.system.traits.value, ["animal", "aquatic"]);
  assert.equal(compiled.actorSource.flags["pf2e-creature-forge"].seed, "compile");
});
