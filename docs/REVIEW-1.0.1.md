# PF2E Creature Forge 1.0.1 – Localization Startup Hotfix Review

## Cause

Foundry expands dotted localization keys into nested objects. The 1.0.0 German and English catalogs contained 33 pairs where a key was both a string value (for example `PF2E_CREATURE_FORGE.Effect.Frightened1`) and a parent of a child key (`...Frightened1.Description`). Foundry therefore attempted to create `Description` on a string and aborted localization loading.

## Fix

- Shipped display-name keys now use `.Name` siblings next to `.Description`.
- Runtime/source references use the new `.Name` keys.
- The embedded fallback catalog retains the legacy 1.0.0 aliases so persisted blueprints that stored an old name key still localize correctly.
- Added a regression test that rejects dotted-key parent/child collisions in `lang/de.json` and `lang/en.json`.

## Verification

- 184/184 automated tests pass.
- `npm run check` passes.
- Both shipped localization catalogs contain zero dotted-key parent/child collisions.
- No schema or gameplay-generation behavior changed.
