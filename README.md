# PF2E Creature Forge

PF2E Creature Forge is an API-first creature generation engine and embeddable editor for Foundry VTT and Pathfinder Second Edition.

Version **0.1.4** completes the first exploration-facing creature statistics layer: skills, movement modes, and senses are now generated from level, role, category, subtypes, attributes, and seeded variation, then compiled into the PF2E NPC source alongside the existing localized strikes.

## What 0.1.4 provides

- Versioned `CreatureGenerationRequest` and `CreatureBlueprint` contracts.
- Seeded deterministic random generation. Generation code does not use `Math.random()`.
- GM Core creature-building tables for AC, HP, saves, Perception, ability modifiers, attack bonuses, attack damage, and skills for levels -1 through 24.
- Road-map roles: Brute, Magical Striker, Skill Paragon, Skirmisher, Sniper, Soldier, and Spellcaster.
- Role-derived six ability modifiers with explicit per-ability overrides.
- Concept defaults for mindless Intelligence and animal Intelligence.
- One or two generated strikes.
- Generated core strike names are localized in German/English through stable `nameKey` identifiers; CreatureBlueprints remain locale-neutral.
- Two-strike mode creates complementary profiles: a more accurate/lower-damage strike and a less accurate/higher-damage strike.
- Melee or ranged attack profiles, attack/damage rank overrides, and damage-type override.
- Role/category/subtype-aware skill generation, with explicit count/rank/preference controls.
- Concept-sensitive land, climb, swim, fly, and burrow movement with manual overrides.
- Concept-sensitive low-light vision, darkvision, and scent with manual overrides.
- Scoped rerolls for HP, defenses, ability modifiers, skills, movement, senses, and attacks.
- PF2E NPC compilation including skills, Perception senses, land/alternate Speeds, and embedded strike items.
- Public content registry for categories, subtypes, name templates, abilities, auras, afflictions, effects, poisons, spell profiles/packages, and loot profiles.
- Embedded Creature Editor contract v2 plus standalone Creature Forge ApplicationV2 host.
- The editor owns its internal scrolling and persistent footer, so Generate, Reroll, and optional Create Actor actions remain visible at the bottom.
- Multiple hosts can mount the same editor implementation; the standalone window contains no second editor implementation.
- Standalone default size increased to 1280×860, with migration from the old default-sized saved window state.
- Runtime discovery of Effect Forge, Aura Forge, Affliction Forge, Item Forge, and Loot Forge.
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

### Generate a creature

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
  attributes: {
    str: "role",
    dex: "role",
    con: "role",
    int: "role",
    wis: "role",
    cha: "role"
  },
  offense: {
    attack: "role",
    damage: "role",
    kind: "melee",
    damageType: "auto"
  },
  skills: {
    count: "role",
    primaryRank: "role",
    preferred: ["athletics"]
  },
  movement: {
    land: "role",
    climb: "auto",
    swim: "auto",
    fly: "auto",
    burrow: "auto"
  },
  senses: {
    lowLightVision: "auto",
    darkvision: "auto",
    scent: "auto",
    scentRange: 30
  },
  options: {
    attackCount: 2
  },
  generation: {
    seed: "example-seed"
  }
});
```

The same request and seed reproduce deterministic generated values.

### Two-strike profile

With `attackCount: 2`, Creature Forge creates an accuracy/damage tradeoff. For example, a Soldier may receive:

```text
Accurate strike  -> higher attack bonus, lower damage band
Heavy strike     -> lower attack bonus, higher damage band
```

The exact values are resolved from the creature's level and the GM Core attack tables.

### Reroll

```js
api.reroll(blueprint, { scope: "all" });
api.reroll(blueprint, { scope: "statistics.hp" });
api.reroll(blueprint, { scope: "defenses" });
api.reroll(blueprint, { scope: "statistics.abilities" });
api.reroll(blueprint, { scope: "statistics.skills" });
api.reroll(blueprint, { scope: "statistics.movement" });
api.reroll(blueprint, { scope: "statistics.senses" });
api.reroll(blueprint, { scope: "combat.attacks" });
```

Attack entries with `locked: true` survive an attack-scope reroll.

### Compile or create a PF2E NPC

```js
const { actorSource, integrationPlan } = api.compile(blueprint);
const { actor } = await api.createActor(blueprint, { renderSheet: true });
```

0.1.4 compiles generated skills, senses, land/alternate movement, and localized strikes into the PF2E NPC source. Future milestones will materialize abilities, auras, afflictions, spellcasting, and loot through the corresponding Forge adapters.

## External content bundles

```js
Hooks.once("pf2eCreatureForgeReady", (api) => {
  api.content.registerBundle({
    id: "my-module.deep-horrors",
    moduleId: "my-module",
    version: "1.0.0",
    content: {
      subtypes: [],
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

## Embedded Creature Editor

The actual editor is not tied to the Creature Forge window. The standalone ApplicationV2 shell mounts the same public editor surface that Encounter Forge or another module can mount later.

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

await editor.mount(containerElement, {
  minHeight: 620
});
```

The embedded editor owns only its editor DOM, state, internal scrolling, validation state, and action footer. The host owns its surrounding window, tabs, persistence, and lifecycle. Primary actions live in the editor footer, so they remain visible while the form and preview scroll independently above it.

```js
editor.element;      // embedded editor root
editor.value;        // CreatureBlueprint snapshot
editor.request;      // CreatureGenerationRequest snapshot
editor.validate();
editor.unmount();
editor.destroy();
```

`api.ui.creatureEditor.contractVersion` is **2**. Supported modes are `create`, `edit`, and `view`; supported layouts are `full` and `compact`.

## Integrations

Creature Forge discovers these optional APIs without taking ownership of their engines:

- PF2E Critical Forge / Effect Forge
- PF2E Aura Forge
- PF2E Affliction Forge
- PF2E Item Forge
- PF2E Loot Forge

```js
api.integrations.getStatus();
```

## Current boundaries

0.1.4 now owns the core numeric statistics, skill selection, movement/senses generation, and localized strike path. Category/subtype defensive affinities, ability recipes, Effect Forge composition, auras, afflictions, spell packages, loot generation, and semantic compendium indexing remain later milestones.

See `docs/ROADMAP.md`.
