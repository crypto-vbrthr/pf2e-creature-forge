# PF2E Creature Forge

PF2E Creature Forge is a new API-first creature generation engine for Foundry VTT and the Pathfinder Second Edition system.

Version **0.1.0** is the architecture foundation. It deliberately focuses on stable contracts before the larger content libraries are added.

## What 0.1.0 already provides

- Versioned `CreatureGenerationRequest` and `CreatureBlueprint` contracts.
- Seeded deterministic random generation. No generation path uses `Math.random()`.
- Pathfinder creature-building rank tables for AC, HP, saves, and Perception for levels -1 through 24.
- Basic road-map roles: Brute, Magical Striker, Skill Paragon, Skirmisher, Sniper, Soldier, and Spellcaster.
- Public content registry for categories, subtypes, name templates, abilities, auras, afflictions, effects, poisons, spell profiles/packages, and loot profiles.
- External content bundles with namespaced IDs and source metadata.
- Embedded Creature Editor contract plus a standalone Creature Forge application.
- Runtime discovery of Effect Forge, Aura Forge, Affliction Forge, Item Forge, and Loot Forge.
- Compendium source discovery API.
- A preliminary PF2E NPC compiler and actor creation endpoint.
- German and English UI.

## Public API

After `ready`:

```js
const api = game.modules.get("pf2e-creature-forge")?.api;
```

The module also fires:

```js
Hooks.on("pf2eCreatureForgeReady", (api) => {});
Hooks.on("pf2eCreatureForgeContentReady", (registrySnapshot) => {});
```

### Generate a blueprint

```js
const blueprint = api.generate({
  identity: {
    name: "Ash Guardian",
    level: 8,
    role: "soldier",
    category: "construct",
    subtypes: ["fire"],
    size: "lg"
  },
  generation: {
    seed: "example-seed"
  }
});
```

With the same request and the same seed, deterministic parts of the generated blueprint are reproduced exactly.

### Reroll

```js
const rerolled = api.reroll(blueprint, { scope: "all" });
const hpOnly = api.reroll(blueprint, { scope: "statistics.hp" });
```

More granular reroll scopes will be added as attacks, abilities, auras, afflictions, spells, and loot enter the generation pipeline.

### Register an external content bundle

```js
Hooks.once("pf2eCreatureForgeReady", (api) => {
  api.content.registerBundle({
    id: "my-module.deep-horrors",
    moduleId: "my-module",
    version: "1.0.0",
    content: {
      subtypes: [
        {
          id: "my-module.abyssal",
          slug: "abyssal",
          label: "Abyssal"
        }
      ],
      abilities: [],
      auras: [],
      afflictions: [],
      effects: [],
      poisons: [],
      nameTemplates: [],
      spellProfiles: [],
      spellPackages: [],
      lootProfiles: []
    }
  });
});
```

Individual registration helpers are also available, for example `registerAbility`, `registerAura`, `registerAffliction`, and `registerNameTemplate`.

## Embedded Creature Editor

```js
const editor = api.ui.creatureEditor.create({
  mode: "edit",
  layout: "compact",
  request: existingRequest,
  capabilities: {
    generation: true,
    actorCreation: false,
    sourceSelection: false
  },
  onChange: ({ blueprint, request, validation }) => {
    // Host owns persistence.
  }
});

await editor.mount(containerElement);
```

The editor does not require its own Foundry window and can therefore be embedded later in Encounter Forge or other modules.

Lifecycle:

```js
editor.value;
editor.request;
editor.validate();
editor.setRequest(request);
editor.setValue(blueprint);
editor.markClean();
editor.unmount();
editor.destroy();
```

## Integrations

Creature Forge 0.1.0 detects, but does not yet deeply compose, these optional Forge APIs:

- PF2E Critical Forge / Effect Forge
- PF2E Aura Forge
- PF2E Affliction Forge
- PF2E Item Forge
- PF2E Loot Forge

Use:

```js
api.integrations.getStatus();
```

The next milestones will connect those adapters to generated abilities and resources rather than duplicate their engines inside Creature Forge.

## Current boundaries

0.1.0 is intentionally not the finished monster generator. Attack statistics, damage, skills, ability selection, auras, afflictions, spell packages, resistances/immunities/weaknesses, loot generation, and compendium indexing are represented in the architecture but are scheduled for subsequent milestones.

See `docs/ROADMAP.md`.
