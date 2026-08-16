# Public API 0.1.3

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
api.generate(request);
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
  offense: {
    attack: "role",
    damage: "role",
    kind: "role",
    damageType: "auto"
  },
  options: { attackCount: 2 }
});
```

Valid attack/damage ranks are `extreme`, `high`, `moderate`, and `low`. Valid ability ranks also include `terrible`. Each setting accepts `role` to use the selected role road map.

### Reroll scopes in 0.1.2

- `all`
- `defenses`
- `statistics.hp`
- `statistics.abilities`
- `combat.attacks` (alias: `attacks`)

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

```js
api.sources.listCompendiums();
api.sources.listCompendiums({ documentName: "Actor" });
api.sources.listCompendiums({ documentName: "Item" });
```

Semantic indexing is a later source-provider milestone.

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
api.ui.creatureEditor.contractVersion; // 2
api.ui.creatureEditor.modes;           // ["create", "edit", "view"]
api.ui.creatureEditor.layouts;         // ["full", "compact"]

const editor = api.ui.creatureEditor.create(options);
await editor.mount(container, { layout: "full", minHeight: 620 });
editor.element;
editor.value;
editor.request;
editor.validate();
editor.setRequest(request);
editor.setValue(blueprint);
editor.markClean();
editor.unmount();
editor.destroy();
```

The editor is a host-neutral embedded surface. It scopes field lookup and event handling to its own root, owns its internal scroll region, and renders its primary actions in a persistent bottom footer. The standalone Creature Forge ApplicationV2 window only hosts this public editor and does not contain a separate editor implementation.
