# Public API 0.2.2

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

## Generation

```js
api.createRequest(input);
api.generate(request);        // synchronous; selected compendium sources must already be prepared
await api.generateAsync(request); // prepares selected category/subtype compendiums first
api.reroll(blueprint, { scope, seed });
api.validateRequest(request);
api.validate(blueprint);
api.compile(blueprint, options);
await api.createActor(blueprint, options);
```

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

### Reroll scopes in 0.2.x

- `all`
- `defenses`
- `statistics.hp`
- `statistics.abilities`
- `statistics.skills` (alias: `skills`)
- `statistics.movement` (alias: `movement`)
- `statistics.senses` (alias: `senses`)
- `combat.attacks` (alias: `attacks`)
- `defenses.affinities` (alias: `affinities`)


## Categories, subtypes, and defensive affinities

`CreatureGenerationRequest` schema v2 supports automatic or manual defensive affinities. Core and external category/subtype definitions may expose:

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
api.content.registerAffliction(definition);
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
await api.sources.setDefaults({ categories: [], subtypes: [] });
```

`CreatureGenerationRequest.sources.categories` and `.subtypes` are independent arrays. Core and non-compendium extension content remains visible regardless of these arrays. Compendium-discovered content is filtered to the selected pack ids.

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
api.ui.creatureEditor.contractVersion; // 4
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

The editor is a host-neutral embedded surface. It scopes field lookup and event handling to its own root, owns its internal scroll region, and renders its primary actions in a persistent bottom footer. Contract v4 moves optional source-selection controls into a dedicated `sources` tab. `sourceSelection: true` exposes the tab and its category/subtype compendium pickers; `persistSourceSelection: true` is intended for the standalone world-default host, while embedded modules should normally leave persistence disabled and carry sources in their own generation request. Hosts can inspect `editor.currentTab`, call `editor.setActiveTab("sources")`, or pass `activeTab` at creation/mount time. The standalone Creature Forge ApplicationV2 window only hosts this public editor and does not contain a separate editor implementation.
