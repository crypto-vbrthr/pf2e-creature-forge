# PF2E Creature Forge 1.1.0 – Stable Release Review

## Release decision

Creature Forge 1.1.0 promotes the reviewed 1.1.0-rc.1 candidate after a successful real Foundry VTT / PF2e smoke test. No gameplay rule, generator, schema, runtime, localization, or integration behavior changed between RC and stable.

## Stable scope

- Interactive Ability Actions with declarative PF2e checks, actions, damage rolls, and GM chat requests.
- Complete PF2e-style German and English rules text for all 50 shipped Core abilities.
- Level-resolved creature DCs for save-based interactive abilities.
- Reviewed Predator Tactics 0.1.0 compatibility.
- Continued validation, compilation, and editor rehydration of persisted 1.0.x Blueprint v11 creatures.

## Public contracts

- Module/API: 1.1.0
- Request schema: v8
- Blueprint schema: v12
- Content schema: v11
- Embedded Creature Editor: v13
- Runtime status: v2

## Verification baseline

The permanent automated suite remains at 192/192 passing tests. The release inherits the clean 1.1.0-rc.1 audits: representative Core + Predator generation produced zero invalid Blueprints, validator warnings, compilation failures, or unresolved ranked DCs; representative persisted 1.0.1 Blueprint v11 creatures remained valid, compilable, and editable. The final Foundry smoke test of 1.1.0-rc.1 completed successfully.

## Result

1.1.0 is the stable release of the interactive-ability line.
