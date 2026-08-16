# PF2E Creature Forge

PF2E Creature Forge is an API-first creature generation engine and embeddable editor for Foundry VTT and Pathfinder Second Edition.

Version **0.3.7** hardens **Localization & Ability Presentation**. Creature Forge now keeps its own DE/EN package strings available as a robust fallback when Foundry does not resolve the module dictionary, while external/system localization continues through Foundry i18n. Ability cards, Effect timing metadata, compiled actions, and applied Effect explanations remain localized consistently.

## What 0.3.7 provides

- Robust embedded DE/EN fallback localization for Creature Forge-owned UI/content keys, including generated abilities, runtime timing labels, traits, and applied Effect explanations.
- Built-in linked effects include concise localized descriptions, and manually applied effects append the localized originating ability as a source note.

- Versioned `CreatureGenerationRequest` and `CreatureBlueprint` contracts.
- Weighted ability generation from category, subtype, role, level, focus tags, and previously selected synergy tags.
- Seeded ability variation with whole-section and single-slot rerolls plus per-ability locks.
- Core starter library of creature abilities for animals/beasts, dragons, undead/ghosts, constructs, elementals, fey, fiends, plants/fungi, oozes, swarms, humanoids, and astral/ethereal concepts.
- Effect-backed ability applications with referenced EffectDefinition schema-v2 resources stored once in `resources.effects`.
- Direct public Effect Forge bridge for validate/analyze/compile/toItemSource/toItemSources/createItem/createItems/apply/execute/compatibility operations.
- Actor creation now materializes each referenced persistent EffectDefinition as world PF2E Effect item resources in a dedicated Creature Forge runtime folder.
- Generated ability descriptions are rewritten after Actor creation with real `@UUID` links to those Effect items plus a manual **Apply effect** control.
- Manual runtime honors ability target metadata: self effects apply to the source NPC automatically; target/failed-save effects use the current Foundry target selection.
- Effect application continues to execute through Effect Forge, including persistent and instant components.
- Runtime resource items are tagged with source-Actor/effect provenance and are cleaned up automatically when the generated Actor is deleted.
- Embedded Effect Editor inside a dedicated, wide Creature Editor workspace for editing an ability's referenced effect definition without duplicating Effect Forge UI.
- External modules can register complete ability/effect bundles and participate in the same weighted generator with provenance.
- Generated abilities compile to embedded PF2E action items while preserving Creature Forge application metadata for later runtime automation.
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
- NPC compendium discovery for additional category and trait-derived subtype candidates.
- Separate category-source and subtype-source selections stored in `CreatureGenerationRequest.sources`.
- Source-aware content resolution: core and external registered content stay available, while compendium-discovered content is visible only when its source is selected.
- Standalone source selections persist as world defaults; embedded hosts can keep selections local.
- Compendium pickers live in a dedicated **Sources** tab instead of occupying the primary creature-generation form.
- Embedded Creature Editor contract v7 plus standalone Creature Forge ApplicationV2 host.
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

0.3.0 additionally compiles generated abilities as action items. Referenced Effect Forge definitions remain neutral resources in the Blueprint so they can be edited, validated, compiled, or applied by the Effect Engine without being incorrectly attached to the creature as self-effects.

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
    effectEditing: true
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

`api.ui.creatureEditor.contractVersion` is **7**. Supported modes are `create`, `edit`, and `view`; supported layouts are `full` and `compact`. The public editor exposes the `creature` and `sources` tabs when source selection is enabled, and hosts can switch tabs with `editor.setActiveTab(...)`.

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

0.3.7 owns the core numeric statistics, category/subtype defensive affinities, source-filtered category/subtype discovery, skill/movement/sense generation, localized strikes, weighted ability selection, Effect Forge composition/editing, persistent effect resource materialization, and visually distinct manual effect application controls. Automatic combat-workflow trigger execution, Aura generation, afflictions, spell packages, and loot generation remain later milestones.

See `docs/ROADMAP.md`.
