# Public API 0.1.0

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

Reroll scopes in 0.1.0:

- `all`
- `defenses`
- `statistics.hp`

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

IDs must be namespaced, e.g. `deep-horrors.crushing-depth`.

## Sources

```js
api.sources.listCompendiums();
api.sources.listCompendiums({ documentName: "Actor" });
api.sources.listCompendiums({ documentName: "Item" });
```

0.1.0 discovers packs. Semantic indexing of categories, subtypes, abilities, auras, and other content comes in a later source-provider milestone.

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

const editor = api.ui.creatureEditor.create(options);
await editor.mount(container);
editor.value;
editor.request;
editor.validate();
editor.setRequest(request);
editor.setValue(blueprint);
editor.markClean();
editor.unmount();
editor.destroy();
```
