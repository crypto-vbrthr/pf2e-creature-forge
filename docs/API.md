# Public API 0.9.0-rc.1

> **0.9.0-rc.1 release-candidate hardening:** public data contracts remain Request v8, Blueprint v11, Content v10, Embedded Creature Editor v13, and runtime-status v2. An embedded editor opened with a persisted Blueprint but no explicit request now rehydrates from `blueprint.metadata.requestSnapshot` and normalizes older snapshots. Optional integration status retains `ready` for API exposure and adds `complete` plus `missingCapabilities` for capability-safe diagnostics.
>
> **0.8.0 Mythic Creatures:** Request schema v8 adds `mythic.enabled` and `mythic.role`; Blueprint schema v11 stores the resolved mythic progression/template. `api.mythic.roles` and `api.mythic.resolveRole(request)` expose the role mapping. Compiled NPCs receive the PF2E `mythic` trait and a 3-point Mythic Point resource.
>
> **0.7.4 full-review hardening:** single-slot ability rerolls now reserve spellcasting power and future locked/preserved ability identities/families, preventing shared-budget overruns and duplicate ability selection. Public schemas remain unchanged.
>
> **0.7.3 runtime hardening:** `flags.pf2e-creature-forge.runtimeStatus` uses schema v2 and reports `ready`, `degraded`, `failed`, or `skipped` for each subsystem. Per-resource warnings are consolidated at Actor level. Effect refreshes preserve hosted Affliction delivery blocks, and `area` target mode resolves all selected targets.


> **0.7.2 area-template presentation:** Compiled ability descriptions emit native PF2E `@Template[...]` links whenever `ability.mechanics.area` is present. No public schema change is required.
>
> **0.7.0 signature powers:** `api.abilities.signature` exposes dynamic signature planning and the Dragon Breath profile/scaling helpers. Dragon Breath is stored as a normal generated ability plus a generated Effect Forge direct-damage resource.
>
> **0.6.5 deferred-loot sheet-layout hardening:** the NPC sheet is no longer modified at render time. The GM-only Loot/Beute header control opens a dedicated Foundry DialogV2 containing deferred salvage/hoard status and materialization actions, so PF2e 8.4's legacy ActorSheet grid remains untouched. The public API remains `api.runtime.createDeferredLootActor(actorOrBlueprint, options)` / `api.loot.createLootActor(...)`.
>
> **0.6.0 loot integration:** Creature generation now carries a first-class loot plan. Loot Forge/Item Forge enrichment is asynchronous, while `api.createActor()` automatically resolves an unresolved loot plan before compiling the NPC. Carried loot and deferred salvage/hoard remain deliberately separate.

```js
const api = game.modules.get("pf2e-creature-forge")?.api;
```

## Version information

```js
api.version;
api.moduleVersion;
api.schemaVersion.request;
api.schemaVersion.blueprint;
api.schemaVersion.content;
```

## Signature powers

```js
api.abilities.signature.limitedAreaDamageFormula(8); // "9d6"
api.abilities.signature.resolveDragonBreathProfile(["fire"]);

const plan = api.abilities.signature.plan({
  identity: { level: 8, role: "brute", category: "dragon", subtypes: ["fire"] }
}, { seed: "dragon-signature", force: true });
```

Signature content remains part of ability libraries. The first dynamic resolver is `dragon-breath`; external libraries can provide compatible signature definitions with `signature.kind: "dragon-breath"`.

## Mythic creatures

```js
const request = api.createRequest({
  identity: { level: 12, role: "sniper", category: "aberration" },
  mythic: { enabled: true, role: "ambusher" }
});

api.mythic.roles; // auto, ambusher, brute, caster, striker
api.mythic.resolveRole(request); // "ambusher"
const blueprint = api.generate(request);
```

`role: "auto"` maps existing Creature Forge roles to a suitable War of Immortals mythic role template. The resolved Blueprint exposes `blueprint.mythic` with its role, Mythic Point pool, resilience saves, conditional resistance/immunity/defenses, selected mythic skills, and generated mythic actions.

## Generation

```js
api.createRequest(input);
api.generate(request);        // synchronous; selected compendium sources must already be prepared
await api.generateAsync(request); // prepares content sources and resolves external loot providers
api.reroll(blueprint, { scope, seed });
api.validateRequest(request);
api.validate(blueprint);
api.compile(blueprint, options);
await api.createActor(blueprint, options);
```

### Actor creation runtime hardening

By default, creation is persistence-first: once the PF2E Actor has been created, optional Creature Forge runtime integrations are initialized independently. A failure in Effect materialization, Aura/Affliction materialization, or spell materialization is recorded instead of aborting the remaining optional runtime steps. The return value keeps the individual subsystem results and adds consolidated diagnostics/status.

```js
const { actor, runtime } = await api.createActor(blueprint);

runtime.creatureForge.runtimeStatus;
runtime.creatureForge.diagnostics;

// Optional fail-fast mode for automation/import pipelines:
await api.createActor(blueprint, { strictRuntime: true });
```

Runtime-status schema v2 reports each subsystem as `ready`, `degraded`, `failed`, or `skipped`. A subsystem is `degraded` when it completed but isolated one or more resource-level diagnostics. `strictRuntime: true` fails only when error-level runtime diagnostics remain; warning-only degradation does not reject the already-created Actor.

When possible, the same status is persisted as `flags.pf2e-creature-forge.runtimeStatus` on the Actor. Failure to persist that diagnostic flag is itself reported without deleting the successfully created Actor. Caller-provided `postCreate` hooks retain normal exception semantics.

### Core statistic request

```js
api.generate({
  identity: {
    level: 10,
    role: "soldier",
    category: "construct",
    subtypes: ["fire"],
    size: "lg"
  },
  attributes: {
    str: "role", dex: "role", con: "role",
    int: "role", wis: "role", cha: "role"
  },
  defenses: {
    ac: "role",
    hp: "role",
    perception: "role",
    saves: { fortitude: "role", reflex: "role", will: "role" }
  },
  defensiveAffinities: {
    mode: "auto",
    hpCompensation: "auto",
    immunities: [],
    resistances: [],
    weaknesses: []
  },
  offense: {
    attack: "role",
    damage: "role",
    kind: "role",
    damageType: "auto"
  },
  skills: {
    count: "role",
    primaryRank: "role",
    preferred: ["athletics", "intimidation"]
  },
  movement: {
    land: "role",
    climb: "auto", swim: "auto", fly: "auto", burrow: "auto"
  },
  senses: {
    lowLightVision: "auto", darkvision: "auto", scent: "auto", scentRange: 30
  },
  options: { attackCount: 2 }
});
```

Valid attack/damage ranks are `extreme`, `high`, `moderate`, and `low`. Valid ability ranks also include `terrible`. Each setting accepts `role` to use the selected role road map.

### Reroll scopes

- `all`
- `defenses`
- `statistics.hp`
- `statistics.abilities`
- `statistics.skills` (alias: `skills`)
- `statistics.movement` (alias: `movement`)
- `statistics.senses` (alias: `senses`)
- `combat.attacks` (alias: `attacks`)
- `defenses.affinities` (alias: `affinities`)
- `abilities`
- `ability:<ability-id>`
- `auras`
- `afflictions`
- `special-features`
- `spellcasting` (alias: `combat.spellcasting`)
- `spell:<spell-id>`
- `loot`
- `loot:equipment | loot:signature | loot:salvage | loot:hoard`

## Spellcasting and thematic spell sources

```js
const blueprint = await api.generateAsync({
  identity: {
    level: 10,
    role: "spellcaster",
    category: "undead",
    subtypes: ["ghost"]
  },
  spellcasting: {
    mode: "required",              // auto | none | required
    style: "auto",                 // auto | innate | prepared | spontaneous
    tradition: "auto",             // auto | arcane | divine | occult | primal
    dcRank: "role",                // role | moderate | high | extreme
    highestRank: "auto",           // auto | 1..10
    breadth: "standard",           // focused | standard | broad
    themes: ["fear", "shadow"]
  },
  sources: {
    spells: ["pf2e.spells-srd"]
  }
});
```

`auto` is deliberately optional: a mundane creature can receive no spellcasting at all. `required` still requires valid spells in the active sources. Automatic tradition and spell selection are constrained by the actually indexed source content and weighted by category, resolved subtypes, role, core/external `spellProfile` content, spell traits, and explicit request themes. Normal spells and cantrips are indexed in 0.5.2; rituals and focus spells are intentionally excluded from this milestone.

Spellcasting uses the same seeded random service and shared power budget as the other special mechanics. `focused`, `standard`, and `broad` control repertoire breadth. Whole spellcasting and individual spell slots can be locked/rerolled with the scopes above.

```js
api.spells.listCompendiums();
api.spells.getDefaultSourceIds();
await api.spells.ensure({ spells: ["pf2e.spells-srd"] });
api.spells.list(["pf2e.spells-srd"]);
api.spells.getStatus();
api.spells.chance(request);
api.spells.highestRankForLevel(10);
api.spells.estimatePower(spellcastingEntry);

await api.runtime.materializeSpellcasting(actor, blueprint);
await api.runtime.refreshSpellcasting(actor, blueprint); // idempotent alias
await api.runtime.cleanupSpellcasting(actor);
```

`api.createActor()` materializes spellcasting by default; pass `{ materializeSpellcasting: false }` to opt out. The compiler creates PF2E NPC `spellcastingEntry` documents, then the runtime clones selected source spells onto the Actor and links them to the generated entry. Prepared casting receives slot references, spontaneous casting receives rank pools, innate ranked spells receive daily uses, and cantrips remain at-will.

`materializeSpellcasting()` / `refreshSpellcasting()` first remove only Creature Forge-owned generated spell Items. Manually added spells remain untouched. Missing or failing source UUIDs are isolated per spell and reported in runtime diagnostics; prepared slots are built only from spell documents that were actually created.

External modules can bias generation without duplicating the spell engine by registering `spellProfile` content:

```js
api.content.registerSpellProfile({
  id: "my-module.abyssal-magic",
  supports: { categories: ["aberration"], subtypes: ["abyssal"] },
  preferredThemes: ["mental", "fear", "teleportation"],
  traditionWeights: { occult: 50, arcane: 10 }
});
```

## Loot, equipment, salvage, and hoards

```js
const blueprint = await api.generateAsync({
  identity: { level: 9, role: "soldier", category: "humanoid" },
  loot: {
    mode: "auto",                 // auto | none | required
    equipment: { mode: "auto" },
    signature: { mode: "auto" },
    salvage: { mode: "none" },
    hoard: { mode: "auto" },
    treasureProfile: "standard",
    hoardProfile: "hoard",
    environment: "urban",
    useItemForge: true
  },
  sources: {
    loot: ["pf2e.equipment-srd", "world.my-items"]
  }
});
```

Loot planning is seeded and concept-sensitive. `auto` is not a promise that a channel appears. For example, animals strongly favor salvage and almost never carried equipment, while humanoids and soldiers favor equipment; high-level spellcasters receive a stronger signature-item preference. `required` bypasses the chance roll for that channel, but a provider can still report that no valid item exists.

The four channels have different persistence semantics:

- `equipment`: generated through Loot Forge and carried by the NPC.
- `signature`: preferably generated through Item Forge, with Loot Forge fallback, and carried by the NPC.
- `salvage`: category/level-derived body material; stored as deferred loot, never added to the living NPC.
- `hoard`: generated through Loot Forge; stored as deferred environment/treasure loot, never added to the living NPC.

```js
api.loot.plan(request, blueprint);
api.loot.chance("salvage", request);
await api.loot.generate(blueprint, request);
await api.loot.refresh(blueprint);
await api.loot.refreshChannel(blueprint, "signature");
api.loot.listCompendiums();
api.loot.getStatus();

await api.runtime.materializeLoot(actor, blueprint);
await api.runtime.refreshLoot(actor, blueprint);
await api.runtime.cleanupCarriedLoot(actor);
await api.runtime.createDeferredLootActor(actor, { includeSalvage: true, includeHoard: true });
// equivalent convenience surface:
await api.loot.createLootActor(actor, { includeSalvage: true, includeHoard: true });
```

`api.createActor()` materializes carried equipment/signature items by default. Pass `{ materializeLoot: false }` to opt out. Creature Forge ownership flags make refresh idempotent: only generated carried loot is replaced, while unrelated manually added inventory stays untouched.

If `api.generate()` was used synchronously, the Blueprint contains a seeded selection plan but may not yet contain external Loot Forge/Item Forge item payloads. `api.createActor()` detects this and resolves the external loot plan before compilation. `api.generateAsync()` already returns the enriched Blueprint.

Source selections are passed directly in provider requests and do not change the providers' world defaults. Creature Forge controls the seeded decision of *which loot channels* exist; the exact item payload generated by an external Forge follows that provider's own random policy.

## Ability libraries and power budget

```js
api.content.registerAbilityLibrary({
  id: "my-module.library",
  moduleId: "my-module",
  version: "1.0.0",
  label: "My Ability Library",
  defaultEnabled: false,
  content: {
    effects: [/* effect resources */],
    abilities: [/* ability definitions */]
  }
});

api.content.listAbilityLibraries();
api.content.getDefaultAbilityLibraryIds();
api.content.validateAbilityLibrary("my-module.library");
api.content.validateAbilityDependencies("my-module.ability.some-power");

api.abilities.estimatePower(definition);
api.abilities.resolvePowerBudget(request);
api.abilities.listLibraries();
```

A generation request selects libraries through `sources.abilities`. An empty array means the registered `defaultEnabled` libraries. Abilities registered loosely through `registerAbility()` or ordinary bundles without a library remain visible for backward compatibility.

`abilities.powerBudget` accepts `"auto"` or an integer from 0 to 30. Each generated ability carries `powerCost`, and the Blueprint records the result in `metadata.abilityBudget`.

Ability applications referencing missing `effect`, `aura`, or `affliction` content are excluded from candidate selection and surfaced as diagnostics.

## Auras, Afflictions, and shared special-feature budget

```js
const blueprint = api.generate({
  identity: { level: 8, role: "spellcaster", category: "undead", subtypes: ["ghost"] },
  abilities: { mode: "auto", count: 2, complexity: "standard", powerBudget: 8 },
  specialFeatures: {
    frequency: "normal",              // rare | normal | high
    auras: { mode: "auto" },         // auto | none | required
    afflictions: { mode: "auto" }    // auto | none | required
  },
  sources: {
    auras: [],                         // empty => default-enabled Aura libraries
    afflictions: []                    // empty => default-enabled Affliction libraries
  }
});
```

`auto` can deliberately produce no Aura or Affliction. The chance is seeded and concept-sensitive. `required` forces only a matching candidate; if none fits the creature, active libraries, dependencies, and remaining power budget, no unrelated content is inserted and a diagnostic is recorded.

Spellcasting is resolved first, then optional Auras/Afflictions, then ordinary abilities. All of them reserve from the same total power budget. The final shared accounting is stored in `blueprint.metadata.specialFeatureBudget`, including `spellcastingSpent`.

```js
api.reroll(blueprint, { scope: "auras" });
api.reroll(blueprint, { scope: "afflictions" });
api.reroll(blueprint, { scope: "special-features" });

api.specialFeatures.chance("aura", request);
api.specialFeatures.estimatePower(definition, "affliction");
api.specialFeatures.listAuraLibraries();
api.specialFeatures.listAfflictionLibraries();
```

### External Aura/Affliction libraries

```js
api.content.registerAuraLibrary({
  id: "my-module.aura-library",
  moduleId: "my-module",
  version: "1.0.0",
  label: "My Auras",
  defaultEnabled: false,
  content: { auras: [/* Aura resources */], effects: [/* optional dependencies */] }
});

api.content.registerAfflictionLibrary({
  id: "my-module.affliction-library",
  moduleId: "my-module",
  version: "1.0.0",
  label: "My Afflictions",
  defaultEnabled: false,
  content: { afflictions: [/* Affliction resources */], effects: [/* optional dependencies */] }
});
```

The current supplied integrations use Aura Forge schema v1 and Affliction Forge schema v2. External libraries should provide definitions accepted by the corresponding Forge API.

### Runtime integration

Actor creation materializes generated Auras as actor-local Aura Forge instances. Generated Afflictions become PF2E Action items with a manual application control that delegates controller creation and progression to Affliction Forge.

```js
await api.runtime.materializeAuras(actor);
await api.runtime.applyAffliction({ actor, afflictionRef: "my-module.affliction.example" });
await api.runtime.refreshSpecialFeatures(actor);

api.auras.validate(auraDefinition);
await api.auras.assignDefinition(actor, auraDefinition);
api.afflictions.validate(afflictionDefinition);
await api.afflictions.applyDefinition(afflictionDefinition, targets);
```

## Effect resources and manual runtime

The Effect Forge bridge exposes both compilation and persistent resource creation:

```js
await api.effects.toItemSource(definition, context);
await api.effects.toItemSources(definition, context);
await api.effects.createItem(definition, options);
await api.effects.createItems(definition, options);
await api.effects.apply(definition, targets, options);
await api.effects.execute(definition, targets, options);
```

`api.createActor()` runs Creature Forge effect materialization by default. Referenced persistent EffectDefinitions become world PF2E Effect Items and generated ability descriptions receive actual UUID references plus manual application controls. Use `{ materializeEffects: false }` to opt out.

```js
const { actor, runtime } = await api.createActor(blueprint);

api.runtime.available;
api.runtime.materializationAvailable;
api.runtime.resolve(actor, { abilityId, effectRef });
api.runtime.resolveTargets(actor, targetMode);
await api.runtime.applyEffect({ actor, abilityId, effectRef, targets });
await api.runtime.materializeEffects(actor);
await api.runtime.refreshActorEffects(actor);
await api.runtime.cleanupActorEffects(actor);
```

Target modes currently handled by the manual runtime include `self`, singular target modes such as `target` / `failed-save-target`, and plural selected-target modes such as `failed-save-targets`. Automatic hit/save workflow triggering remains a later runtime milestone.

## Categories, subtypes, and defensive affinities

`CreatureGenerationRequest` schema v7 supports automatic/manual defensive affinities, ability generation, optional Aura/Affliction special-feature controls, first-class spellcasting configuration/source selection, and first-class loot channel/source policy. Core and external category/subtype definitions may expose:

```js
{
  grantedTraits: ["magical"],
  impliedSubtypes: ["incorporeal"],
  defensiveAffinities: [
    {
      id: "physical-resistance",
      kind: "resistance",
      type: "physical",
      scale: "minimum",
      exceptions: ["silver"],
      priority: 20,
      when: { minimumLevel: 1 },
      chance: { conservative: 0.5, balanced: 0.75, experimental: 1 }
    }
  ]
}
```

`scale` can be `minimum` or `maximum`; values are resolved from the level-based resistance/weakness table. Rules can also use a fixed `value`, `doubleVs`, `hpMultiplier`, `locked`, category/subtype predicates, and `minimumLevel`/`maximumLevel` predicates.

Generated Blueprints expose:

```js
defenses: {
  immunities: [{ type: "fire", source: { kind: "subtype", id: "..." } }],
  resistances: [{ type: "physical", value: 7, exceptions: ["silver"], source: { ... } }],
  weaknesses: [{ type: "holy", value: 13, source: { ... } }],
  hpAdjustment: { value: 12, reasons: [...] }
}
```

The resolver expands implied subtypes before other generation layers run, so a `ghost` subtype can contribute `incorporeal` behavior to movement, senses, traits, and affinities. Manual request entries have the highest priority and suppress conflicting generated entries.

## Generated exploration statistics

Skills are stored by PF2E skill slug and retain both the semantic rank used by Creature Forge and the resolved modifier:

```js
statistics: {
  skills: {
    stealth: { slug: "stealth", attribute: "dex", rank: "high", value: 18, special: [], locked: false }
  },
  speed: {
    land: 30,
    other: [{ type: "swim", value: 30, source: "generated", locked: false }]
  },
  senses: [
    { type: "darkvision", acuity: "precise", range: null, source: "generated", locked: false },
    { type: "scent", acuity: "imprecise", range: 30, source: "generated", locked: false }
  ]
}
```

Automatic skill choice is weighted by role, category, subtype, and the generated ability profile. Automatic movement/senses are concept-sensitive; explicit numeric speeds and `on`/`off` sense settings override those suggestions.

## Generated attack shape

```js
{
  id: "attack-1",
  profile: "accurate",
  name: "Claw",
  kind: "melee",
  attack: { rank: "high", value: 23 },
  damage: {
    rank: "moderate",
    formula: "2d10+11",
    average: 22,
    type: "slashing"
  },
  traits: ["unarmed", "agile"],
  range: null,
  locked: false
}
```

With two strikes, the first is the accurate profile and the second is the heavy profile. Attack-scope rerolls preserve entries marked `locked: true` by ID.

## Ability Engine

```js
const request = api.createRequest({
  identity: { level: 8, role: "skirmisher", category: "undead", subtypes: ["ghost"] },
  abilities: { mode: "auto", count: 3, complexity: "standard", focus: ["fear", "movement"] }
});

api.abilities.listCandidates(request);
const blueprint = api.generate(request);
api.reroll(blueprint, { scope: "abilities" });
api.reroll(blueprint, { scope: "ability:ability-2" });
```

External ability definitions use `abilityType` (`action`, `reaction`, `free`, or `passive`) because the registry reserves top-level `type` for the content type. Typical fields include `actionCost`, `category`, `family`, `baseWeight`, `traits`, `tags`, `selection`, `synergy`, and `applications`. Effect applications reference a registered effect id:

```js
api.content.registerBundle({
  id: "my-module.horrors",
  moduleId: "my-module",
  version: "1.0.0",
  content: {
    effects: [{
      id: "my-module.effect.sticky",
      nameKey: "MY_MODULE.Effect.Sticky.Name",
      descriptionKey: "MY_MODULE.Effect.Sticky.Description",
      definition: { schemaVersion: 2, id: "my-module.effect.sticky", name: "Sticky", description: "", components: [] }
    }],
    abilities: [{
      id: "my-module.ability.adhesive-wave",
      abilityType: "action",
      actionCost: 2,
      family: "adhesive-wave",
      baseWeight: 80,
      tags: ["ooze", "control"],
      selection: { categories: ["ooze"] },
      applications: [{ type: "effect", ref: "my-module.effect.sticky", target: "failed-save-target", timing: "failed-save" }]
    }]
  }
});
```

The Blueprint stores selected abilities in `abilities[]` and only referenced effect definitions in `resources.effects[]`.

## Effect Forge bridge

When PF2E Critical Forge / Effect Forge is active:

```js
api.effects.available;
api.effects.validate(definition);
api.effects.analyze(definition, context);
await api.effects.compile(definition, context);
await api.effects.toItemSource(definition, context);
await api.effects.apply(definition, targets, options);
await api.effects.execute(definition, targets, options);
await api.effects.checkCompatibility(definition, target, options);
```

The canonical Embedded Creature Editor uses the external `api.ui.effectEditor.create(...)` implementation for editing referenced effect resources. Creature Forge does not maintain a second Effect Editor.

## Random service

```js
const seed = api.random.createSeed();
const random = api.random.create(seed);
random.next();
random.int(1, 20);
random.pick(entries);
random.weightedPick([{ value: "a", weight: 2 }, { value: "b", weight: 1 }]);
random.shuffle(entries);
random.chance(0.25);
random.fork("abilities");
```

## Content

```js
api.content.registerBundle(bundle);
api.content.unregisterBundle(bundleId);
api.content.registerCategory(definition);
api.content.registerSubtype(definition);
api.content.registerNameTemplate(definition);
api.content.registerAbility(definition);
api.content.registerAura(definition);
api.content.registerAuraLibrary(library);
api.content.unregisterAuraLibrary(libraryId);
api.content.listAuraLibraries();
api.content.registerAffliction(definition);
api.content.registerAfflictionLibrary(library);
api.content.unregisterAfflictionLibrary(libraryId);
api.content.listAfflictionLibraries();
api.content.registerEffect(definition);
api.content.registerPoison(definition);
api.content.registerSpellProfile(definition);
api.content.registerSpellPackage(definition);
api.content.registerLootProfile(definition);
api.content.get(type, id);
api.content.list(type, filters);
api.content.query(type, creatureContext);
api.content.unregister(type, id);
api.content.getDiagnostics();
api.content.getRegistrySnapshot();
```

## Sources

Generic compendium listing remains available:

```js
api.sources.listCompendiums();
api.sources.listCompendiums({ documentName: "Actor" });
api.sources.listCompendiums({ documentName: "Item" });
```

NPC category/subtype discovery (introduced in 0.2.1):

```js
api.sources.listCreatureCompendiums();
await api.sources.discover("pf2e.some-bestiary");
await api.sources.ensure({
  categories: ["pf2e.some-bestiary"],
  subtypes: ["pf2e.some-bestiary"]
});

api.sources.listContent("category", { selectedSources: ["pf2e.some-bestiary"] });
api.sources.listContent("subtype", { selectedSources: ["pf2e.some-bestiary"] });
api.sources.isPrepared({ categories: ["pf2e.some-bestiary"] });
api.sources.getStatus();
api.sources.clearCache();

api.sources.getDefaults();
await api.sources.setDefaults({ categories: [], subtypes: [], abilities: [], auras: [], afflictions: [] });
```

### Affliction Forge library bridge

```js
api.afflictions.libraries.available;
await api.afflictions.libraries.refresh({ force: true });
api.afflictions.libraries.list();
await api.afflictions.libraries.ensure(["pf2e-creature-forge.affliction-forge.some-library"]);
api.afflictions.libraries.status();

await api.sources.refreshAfflictionLibraries({ force: true });
```

Provider/world Affliction Forge libraries are bridged as selectable Creature Forge Affliction sources. Generic implicit Item-compendium libraries are visible but are not default-enabled. Unedited bridged entries retain their canonical `templateUuid`; editing them detaches the Creature Blueprint resource so actor creation cannot mutate or misrepresent the source template. `api.sources.ensure(...)`, `isPrepared(...)`, and `getStatus()` include the Affliction bridge as well as category/subtype compendium discovery.

`CreatureGenerationRequest.sources.categories`, `.subtypes`, `.abilities`, `.auras`, and `.afflictions` are independent arrays. Core and non-compendium extension content remains visible regardless of these arrays. Compendium-discovered content is filtered to the selected pack ids.

When a request uses unprepared compendium sources, prefer `await api.generateAsync(request)`. For repeated synchronous generation, call `await api.sources.ensure(request.sources)` once before `api.generate(request)`.

## Integrations

```js
api.integrations.getStatus();
api.integrations.getEffectApi();
api.integrations.getAuraApi();
api.integrations.getAfflictionApi();
api.integrations.getItemApi();
api.integrations.getLootApi();
```

## UI

```js
api.ui.openCreatureForge();
api.ui.creatureEditor.contractVersion; // 12
api.ui.creatureEditor.modes;           // ["create", "edit", "view"]
api.ui.creatureEditor.layouts;         // ["full", "compact"]
api.ui.creatureEditor.tabs;            // ["creature", "sources"]

const editor = api.ui.creatureEditor.create(options);
await editor.mount(container, { layout: "full", minHeight: 620 });
editor.element;
editor.currentTab;
editor.setActiveTab("sources");
editor.value;
editor.request;
editor.validate();
await editor.setRequest(request);
await editor.refreshSources({ force: true });
await editor.setValue(blueprint);
editor.markClean();
editor.unmount();
editor.destroy();
```

The editor is a host-neutral embedded surface. It scopes field lookup and event handling to its own root, owns its internal scroll region, and renders its primary actions in a persistent bottom footer. Contract v12 keeps source selection in the dedicated `sources` tab, adds loot Item-compendium selection plus loot controls/channel locks/rerolls, preserves spellcasting controls, and retains host-controllable `effectEditing`, `auraEditing`, and `afflictionEditing` capabilities for mounting the public Forge editors in the same editor workspace. `sourceSelection: true` exposes the tab and its category/subtype compendium pickers; `persistSourceSelection: true` is intended for the standalone world-default host, while embedded modules should normally leave persistence disabled and carry sources in their own generation request. Hosts can inspect `editor.currentTab`, call `editor.setActiveTab("sources")`, or pass `activeTab` at creation/mount time. The standalone Creature Forge ApplicationV2 window only hosts this public editor and does not contain a separate editor implementation.


### Signature powers 0.7.2

`api.abilities.signature.resolveElementalSignatureProfile(subtypes)` resolves the same locale-neutral elemental affinity used by the new Elemental Retaliation signature family. `api.abilities.signature.plan(...)` can now return dragon-breath, troll-regeneration, vampiric-drain, hydra-heads, phoenix-rebirth, or elemental-retaliation abilities when their category/subtype requirements match.
