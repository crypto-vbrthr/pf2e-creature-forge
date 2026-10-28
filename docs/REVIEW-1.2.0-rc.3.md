# Creature Forge 1.2.0-rc.3: Actor Creation / Lock-Flag Hotfix

## User-reported failure

When creating an NPC from a generated Creature Forge blueprint in Foundry 14 / PF2e 8.6.1, the console showed `TypeError: Cannot use 'in' operator to search for 'affinities' in false`, originating in `foundry.mjs` `setProperty` / `expandObjectInPlace` during `migrateActorSource` and Actor creation.

## Root cause

Since 1.2.0 introduced section locks, an Actor flag stored the **entire blueprint** under `flags["pf2e-creature-forge"].blueprint`. Section locks used literal dotted keys (for example `locks["defenses.affinities"]`) alongside `locks.defenses: false` or `true`. Foundry expands dotted object keys inside Actor flags as nested property paths. It therefore tried to assign `affinities` **inside a boolean** `locks.defenses`, triggering the reported exception. The previous integration audits validated compiled data objects without executing Foundry's schema expansion, so they missed the collision.

## Fix

- Dotted UI scope identifiers are preserved, but lock state is now stored using dot-free identifiers (`defenses_affinities`, `statistics_hp`, etc.), eliminating the colliding flag names.
- The previous boolean `defenses` section remains independent of the affinity section.
- Legacy preview and actor blueprint lock maps are normalized before rerolls, and cloned/normalized before they are embedded in an Actor source. Old lock states remain effective, including previously partially expanded non-colliding dotted keys.
- Blueprint schema remains v12, Request v8, Content v11; no changes to spells, abilities, or addons.

## Regression validation

- Automated tests check every lock's storage key, all four defense/affinity lock combinations, source flag objects with no dotted keys, legacy input immutability, reroll migration, and the mocked `Actor.create` pathway.
- **216/216 tests passed**; `npm run check` passed.
- Additional mixed Core + Predator Tactics 0.1.1 + Brutal Physiology 0.1.0 audit: **320 generated creatures**, **960 full rerolls** with varied section locks, **1,280 compiled Actor sources**, **0 invalid blueprints**, **0 warnings**, **0 unsafe dotted Actor flag keys**, **0 lock failures**.
- Final archive was independently extracted and must pass the same suite and syntax check.

## Foundry smoke test still needed

1. Generate a creature, lock **Defenses**, and reroll **Immunities, Resistances & Weaknesses** independently.
2. Click **Create Creature**; the NPC should save and open without a console exception.
3. Repeat with the defensive affinity lock enabled and with both defense sections locked.

