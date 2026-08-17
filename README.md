# PF2E Creature Forge

PF2E Creature Forge is an API-first creature generation engine and embeddable editor for Foundry VTT and Pathfinder Second Edition.

Version **0.5.0** adds **Spellcasting & Thematic Spell Selection**. Creature Forge can now decide whether spellcasting fits a creature concept, select a tradition and casting style, index spells from chosen PF2E spell compendiums, choose a thematic repertoire, and materialize real PF2E NPC spellcasting entries and spell Items.

## What 0.5.0 provides

- Optional, seeded, concept-sensitive spellcasting with `auto | none | required` modes.
- Innate, prepared, and spontaneous creature spellcasting. Focus spells and rituals are deliberately deferred.
- GM Core spell DC and spell-attack bands from level -1 through 24, plus automatic highest spell rank by creature level.
- Thematic weighted selection from chosen Item spell compendiums using category, subtype, role, tradition, traits, and explicit theme hints.
- Source-local spell indexing; the Sources tab has a dedicated spell-compendium selector and embedded hosts keep their own source selection.
- Focused, standard, and broad spell repertoires with spellcasting participating in the same shared creature power budget as Auras, Afflictions, and abilities.
- Whole-spellcasting and individual-spell locks/rerolls.
- PF2E Actor materialization for spellcasting entries plus linked spell Items, prepared slots, spontaneous rank pools, innate daily uses, and at-will cantrips.
- External modules can register `spellProfile` content to bias tradition/theme selection without replacing the engine.
- Embedded Creature Editor contract v11; request schema v6; Blueprint/content schemas v8; API/module version 0.5.0.
- 122 automated tests pass across generation, source indexing, UI contracts, compiler/runtime integration, localization, and regression coverage.

## What 0.4.3 provided

- Localized generated host descriptions such as **Überträgt Leiden** instead of `Transmits affliction`.
- Localized delivery metadata such as **Bei verursachtem Schaden · Automatisch** instead of `on-damage · automatic`.
- Localized Affliction action delivery labels such as **Übertragung**.
- Regenerated the embedded DE/EN fallback catalog from the shipped language files so every package-owned key is available even when Foundry returns raw localization IDs.
- Added a regression test that verifies every shipped language key exists in the embedded fallback catalog.
- No schema or Embedded Editor contract change; this is a localization-only hardening release.
- 107 automated tests pass, including direct German runtime-description regression coverage.

## What 0.4.2 provided

- Real Affliction Forge provider/world libraries appear as selectable Creature Forge Affliction sources.
- Implicit generic Item-compendium libraries remain opt-in so Creature Forge does not scan every Item pack by default.
- Unmodified library afflictions keep their canonical Affliction Forge template UUID and published level/DC.
- Editing a bridged affliction detaches it into a creature-local definition so the source library entry is never mutated.
- Poison/disease/curse semantics, traits, level windows, categories/subtypes, and delivery preferences feed weighted selection.
- Hosted delivery resolves the generated PF2E attack/ability, writes the native Affliction Forge reference, then reads it back to verify persistence.
- Verified bindings are shown as linked; failures visibly fall back to manual application instead of silently pretending the host is wired.
- Unchanged library content uses Affliction Forge `engine.applyTemplate()`; generated/edited definitions use `engine.applyDefinition()`.
- Existing optional Aura/Affliction generation, shared power budget, seeded rerolls, Embedded Aura/Affliction/Effect editors, and external Creature Forge libraries remain available.
- Embedded Creature Editor contract v10, Blueprint/content schema v7, request schema v5.

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

`api.ui.creatureEditor.contractVersion` is **11**. Supported modes are `create`, `edit`, and `view`; supported layouts are `full` and `compact`. The public editor exposes the `creature` and `sources` tabs when source selection is enabled, and hosts can switch tabs with `editor.setActiveTab(...)`.

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

0.5.0 owns the core numeric statistics, category/subtype defensive affinities, source-filtered discovery, skill/movement/sense generation, localized strikes, weighted ability selection, Effect Forge composition/editing/runtime, optional Aura/Affliction selection and verified delivery, plus thematic PF2E spellcasting generation and materialization. Automatic combat-workflow trigger execution, focus-spell generation, advanced hand-curated spell packages, and loot generation remain later milestones.

See `docs/ROADMAP.md`.
