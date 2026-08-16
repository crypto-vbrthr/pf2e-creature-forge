import test from "node:test";
import assert from "node:assert/strict";
import { CreatureEffectRuntime } from "../scripts/runtime/effect-runtime.js";

function makeBlueprint(target = "target") {
  return {
    abilities: [{
      id: "ability-1",
      name: "Menacing Display",
      description: "Threatens a target.",
      applications: [{ type: "effect", ref: "test.effect.frightened", target, timing: "failed-save" }]
    }],
    resources: {
      effects: [{
        id: "test.effect.frightened",
        contentId: "test.effect.frightened",
        name: "Frightened",
        nameKey: "PF2E_CREATURE_FORGE.Effect.Frightened1",
        descriptionKey: "PF2E_CREATURE_FORGE.Effect.Frightened1.Description",
        definition: { id: "test.effect.frightened", name: "Frightened", description: "", schemaVersion: 2, components: [] }
      }]
    }
  };
}

function makeActor(blueprint) {
  const abilityItem = {
    id: "item-ability",
    flags: { "pf2e-creature-forge": { abilityId: "ability-1" } }
  };
  const actor = {
    id: "actor-1",
    uuid: "Actor.actor-1",
    level: 5,
    flags: { "pf2e-creature-forge": { blueprint } },
    items: [abilityItem],
    updateCalls: [],
    itemUpdateCalls: [],
    async update(changes) { this.updateCalls.push(changes); return this; },
    async updateEmbeddedDocuments(_type, updates) { this.itemUpdateCalls.push(...updates); return updates; }
  };
  return actor;
}

test("runtime materializes linked Effect Forge resources and rewrites ability descriptions with UUID and apply controls", async () => {
  const previous = { game: globalThis.game, Folder: globalThis.Folder };
  const blueprint = makeBlueprint();
  const actor = makeActor(blueprint);
  const resourceItem = {
    id: "effect-item-1",
    uuid: "Item.effect-item-1",
    flags: {},
    updateCalls: [],
    async update(changes) { this.updateCalls.push(changes); return this; }
  };
  const calls = [];
  const runtime = new CreatureEffectRuntime({
    integrations: {
      effectApi: {
        effects: {
          apply: async () => [],
          createItems: async (definition) => { calls.push({ id: definition.id, description: definition.description }); return [resourceItem]; }
        }
      }
    }
  });
  globalThis.game = {
    i18n: {
      localize: (key) => ({
        "PF2E_CREATURE_FORGE.Effect.Frightened1": "Verängstigt",
        "PF2E_CREATURE_FORGE.Effect.Frightened1.Description": "Verängstigt 1 senkt Würfe und SG um 1.",
        "PF2E_CREATURE_FORGE.Runtime.Timing.FailedSave": "Bei misslungenem Rettungswurf",
        "PF2E_CREATURE_FORGE.Action.ApplyEffect": "Effekt anwenden"
      }[key] ?? key),
      format: (key) => key
    },
    user: { targets: new Set() },
    items: [],
    folders: []
  };
  globalThis.Folder = { create: async () => ({ id: "folder-1", type: "Item", flags: { "pf2e-creature-forge": { runtimeEffectResources: true } } }) };
  try {
    const result = await runtime.initializeActor(actor, blueprint);
    assert.deepEqual(calls, [{ id: "test.effect.frightened", description: "Verängstigt 1 senkt Würfe und SG um 1." }]);
    assert.equal(result.materialization.resources["test.effect.frightened"].primaryUuid, "Item.effect-item-1");
    assert.equal(resourceItem.updateCalls[0].folder, "folder-1");
    const description = actor.itemUpdateCalls[0]["system.description.value"];
    assert.match(description, /@UUID\[Item\.effect-item-1\]\{Verängstigt\}/);
    assert.match(description, /class="pf2e-creature-forge-effect-reference"/);
    assert.match(description, /class="pf2e-creature-forge-effect-timing"/);
    assert.match(description, /Bei misslungenem Rettungswurf/);
    assert.doesNotMatch(description, />failed-save</);
    assert.match(description, /<button type="button" class="pf2e-creature-forge-apply-effect"/);
    assert.match(description, /aria-label="Effekt anwenden"|aria-label="PF2E_CREATURE_FORGE.Action.ApplyEffect"/);
    assert.doesNotMatch(description, /href=/);
    assert.match(description, /data-cf-actor-uuid="Actor\.actor-1"/);
    assert.ok(actor.updateCalls.some((changes) => changes["flags.pf2e-creature-forge.runtime"]?.effects));
  } finally {
    globalThis.game = previous.game;
    globalThis.Folder = previous.Folder;
  }
});

test("manual runtime applies a linked effect to selected targets and honors self targeting", async () => {
  const previousGame = globalThis.game;
  const targetActor = { id: "target-actor", uuid: "Actor.target" };
  const targetToken = { id: "token-1", actor: targetActor };
  const calls = [];
  const runtime = new CreatureEffectRuntime({
    integrations: {
      effectApi: {
        effects: {
          createItems: async () => [],
          apply: async (definition, targets, options) => {
            calls.push({ definition, targets, options });
            return [];
          }
        }
      }
    }
  });
  globalThis.game = {
    user: { targets: new Set([targetToken]) },
    i18n: {
      localize: (key) => ({
        "PF2E_CREATURE_FORGE.Effect.Frightened1": "Verängstigt",
        "PF2E_CREATURE_FORGE.Effect.Frightened1.Description": "Verängstigt 1 senkt Würfe und SG um 1.",
        "PF2E_CREATURE_FORGE.Runtime.EffectSource": "Quelle"
      }[key] ?? key)
    }
  };
  try {
    const actor = makeActor(makeBlueprint("target"));
    const result = await runtime.apply({ actor, abilityId: "ability-1", effectRef: "test.effect.frightened" });
    assert.deepEqual(result.targets, [targetToken]);
    assert.equal(calls[0].definition.id, "test.effect.frightened");
    assert.equal(calls[0].definition.name, "Verängstigt");
    assert.match(calls[0].definition.description, /Verängstigt 1 senkt Würfe und SG um 1\./);
    assert.match(calls[0].definition.description, /<strong>Quelle:<\/strong> Menacing Display/);
    assert.equal(calls[0].options.context.actor, actor);

    const selfActor = makeActor(makeBlueprint("self"));
    await runtime.apply({ actor: selfActor, abilityId: "ability-1", effectRef: "test.effect.frightened" });
    assert.deepEqual(calls[1].targets, [selfActor]);
    assert.equal(calls[1].definition.name, "Verängstigt");
    assert.match(calls[1].definition.description, /<strong>Quelle:<\/strong> Menacing Display/);
  } finally {
    globalThis.game = previousGame;
  }
});

test("manual runtime refuses target effects when no Foundry targets are selected", async () => {
  const previousGame = globalThis.game;
  const runtime = new CreatureEffectRuntime({
    integrations: { effectApi: { effects: { createItems: async () => [], apply: async () => [] } } }
  });
  globalThis.game = { user: { targets: new Set() }, i18n: { localize: (key) => key } };
  try {
    const actor = makeActor(makeBlueprint("failed-save-targets"));
    await assert.rejects(
      () => runtime.apply({ actor, abilityId: "ability-1", effectRef: "test.effect.frightened" }),
      /Select at least one target/
    );
  } finally {
    globalThis.game = previousGame;
  }
});

test("runtime uses embedded German catalog for effect explanation and ability source when Foundry package keys are unresolved", async () => {
  const previousGame = globalThis.game;
  const calls = [];
  const runtime = new CreatureEffectRuntime({
    integrations: {
      effectApi: {
        effects: {
          createItems: async () => [],
          apply: async (definition, targets) => { calls.push({ definition, targets }); return []; }
        }
      }
    }
  });
  globalThis.game = {
    i18n: { lang: "de", localize: (key) => key, format: (key) => key },
    user: { targets: new Set() }
  };
  try {
    const blueprint = makeBlueprint("self");
    blueprint.abilities[0].nameKey = "PF2E_CREATURE_FORGE.Ability.MenacingDisplay.Name";
    blueprint.resources.effects[0].nameKey = "PF2E_CREATURE_FORGE.Effect.Frightened1";
    blueprint.resources.effects[0].descriptionKey = "PF2E_CREATURE_FORGE.Effect.Frightened1.Description";
    const actor = makeActor(blueprint);
    await runtime.apply({ actor, abilityId: "ability-1", effectRef: "test.effect.frightened" });
    assert.equal(calls[0].definition.name, "Verängstigt");
    assert.match(calls[0].definition.description, /Verängstigt 1 verleiht einen Statusmalus/);
    assert.match(calls[0].definition.description, /<strong>Quelle:<\/strong> Drohgebärde/);
  } finally {
    globalThis.game = previousGame;
  }
});
