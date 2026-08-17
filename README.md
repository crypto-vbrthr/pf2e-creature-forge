# PF2E Creature Forge

PF2E Creature Forge is an API-first creature generation engine and embeddable editor for Foundry VTT and Pathfinder Second Edition.

Version **0.4.1** hardens **Affliction Delivery & Aura/Affliction Runtime** on top of the 0.4.0 integration. Auras and afflictions are optional, concept-sensitive special features that participate in the same seeded variation and shared power budget as generated abilities. They can be disabled, generated automatically, or required explicitly.

## What 0.4.0 provides

- `specialFeatures.frequency`: `rare`, `normal`, or `high`.
- Independent Aura/Affliction modes: `auto`, `none`, or `required`.
- `auto` is genuinely optional: a valid generation may contain no Aura and/or no Affliction.
- Concept-sensitive probability from category and subtypes; poison, disease, ghost, elemental, fiend, celestial, fungus, and related concepts alter the odds rather than forcing content.
- `required` selects only a valid matching feature. If no candidate fits the concept, selected sources, dependencies, and remaining budget, generation keeps the slot empty and emits a diagnostic instead of inserting unrelated content.
- Auras, afflictions, and ordinary abilities share one power budget.
- Seeded selection, scoped rerolls, and locks for Auras and Afflictions.
- Core Aura and Affliction starter libraries plus public external library registration.
- Dedicated Aura/Affliction library selectors in the **Sources** tab, with standalone world defaults and embedded host-local selection.
- Embedded Aura Forge and Affliction Forge editors inside the canonical Embedded Creature Editor.
- Actor creation materializes generated Auras as actor-local Aura Forge definitions, keeping the global Aura Library clean.
- Generated Afflictions compile to PF2E Action items with a manual **Apply affliction** runtime control and delegate the actual controller/application lifecycle to Affliction Forge.
- Definitions are generated against the current integration contracts used by the supplied Aura Forge (schema v1) and Affliction Forge (schema v2); stage effects use Affliction-owned unlimited effect duration.
- External modules can register complete Aura/Affliction libraries and participate in the same source filtering, weighting, power budgeting, reroll, and provenance logic as core content.
- Embedded Creature Editor contract v9 and request/blueprint/content schema v5.

Existing 0.3.x features remain: weighted ability libraries, Effect Forge integration and manual runtime, deterministic seeded generation, GM Core statistic tables, attacks, skills, movement, senses, defensive affinities, compendium category/subtype discovery, and DE/EN localization.

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

### Effect materialization and manual runtime

`api.createActor()` materializes referenced persistent Effect Forge definitions after the NPC exists, then rewrites the generated ability Items with UUID references and manual apply controls. This can be disabled for specialized hosts with `materializeEffects: false`.

```js
const { actor, runtime } = await api.createActor(blueprint);

await api.runtime.applyEffect({
  actor,
  abilityId: "ability-1",
  effectRef: "pf2e-creature-forge.effect.frightened-1"
});

await api.runtime.refreshActorEffects(actor);
await api.runtime.cleanupActorEffects(actor);
```

Targeted effects use the current Foundry target selection. `target: "self"` effects apply to the creature itself. Persistent materialized reference Items are world Items kept in the dedicated **PF2E Creature Forge – Runtime Effects** folder; instant-only effects remain directly executable but do not need a persistent reference Item.

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

### Ability generation and Effect Forge

```js
const blueprint = api.generate({
  identity: { level: 8, role: "skirmisher", category: "undead", subtypes: ["ghost"] },
  abilities: { mode: "auto", count: 3, complexity: "standard", focus: ["fear", "movement"] },
  generation: { seed: "haunting-17" }
});

api.reroll(blueprint, { scope: "abilities" });
api.reroll(blueprint, { scope: "ability:ability-2" });

const effect = blueprint.resources.effects[0]?.definition;
if (effect && api.effects.available) {
  api.effects.validate(effect);
  api.effects.analyze(effect, { level: blueprint.identity.level });
}
```

Abilities may reference one or more neutral `resources.effects` entries. The Embedded Creature Editor opens Critical Forge's public Embedded Effect Editor for those definitions when the integration is active.

### Compile or create a PF2E NPC

```js
const { actorSource, integrationPlan } = api.compile(blueprint);
const { actor } = await api.createActor(blueprint, { renderSheet: true });
```

Creature Forge compiles generated abilities as action items. Referenced Effect Forge definitions remain neutral resources in the Blueprint so they can be edited, validated, compiled, or applied by the Effect Engine without being incorrectly attached to the creature as self-effects.

## Compendium category/subtype discovery

NPC compendiums can be selected independently as category and subtype sources. Core/registered extension content is always available; discovered compendium content is request-scoped.

```js
const request = api.createRequest({
  sources: {
    categories: ["pf2e.some-bestiary"],
    subtypes: ["pf2e.some-bestiary", "my-module.campaign-creatures"]
  }
});

// Async generation prepares/scans the selected packs first.
const blueprint = await api.generateAsync(request);

// Or prepare once, then use the synchronous generator repeatedly.
await api.sources.ensure(request.sources);
const another = api.generate(request);
```

Useful source API calls:

```js
api.sources.listCompendiums({ documentName: "Actor" });
await api.sources.discover("pf2e.some-bestiary");
await api.sources.ensure(request.sources);
api.sources.listContent("category", { selectedSources: request.sources.categories });
api.sources.listContent("subtype", { selectedSources: request.sources.subtypes });
api.sources.getStatus();
```

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
    sourceSelection: true,
    persistSourceSelection: false,
    effectEditing: true,
    auraEditing: true,
    afflictionEditing: true
  },
  onChange: ({ blueprint, request, validation }) => {
    // Host owns persistence.
  }
});

await editor.mount(containerElement, {
  minHeight: 620
});
```

The embedded editor owns its editor DOM, state, internal scrolling, validation state, Creature/Sources sub-tabs, and action footer. The host owns its surrounding window, higher-level navigation, persistence policy, and lifecycle. Primary actions live in the editor footer, so they remain visible while the form and preview scroll independently above it.

```js
editor.element;      // embedded editor root
editor.value;        // CreatureBlueprint snapshot
editor.request;      // CreatureGenerationRequest snapshot
editor.validate();
editor.unmount();
editor.destroy();
```

`api.ui.creatureEditor.contractVersion` is **9**. Supported modes are `create`, `edit`, and `view`; supported layouts are `full` and `compact`. The public editor exposes the `creature` and `sources` tabs when source selection is enabled, and hosts can switch tabs with `editor.setActiveTab(...)`.

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

0.4.0 owns the core numeric statistics, category/subtype defensive affinities, source-filtered category/subtype discovery, skill/movement/sense generation, localized strikes, weighted ability selection, Effect Forge composition/editing/runtime, and optional Aura/Affliction selection/editing/runtime delegation. Automatic combat-workflow trigger execution, spell packages, and loot generation remain later milestones. 0.4.1 binds compatible generated Afflictions to attacks or abilities through actor-local Affliction Forge templates and references; unsupported concepts keep a manual fallback.

See `docs/ROADMAP.md`.
