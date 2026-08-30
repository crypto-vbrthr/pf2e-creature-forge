# PF2E Creature Forge 1.1.0-rc.1 – Release Candidate Review

## Scope

This review covers the 1.1 interactive-ability line after the successful Foundry usability check of 1.1.0-dev.2. The candidate is reviewed against six release gates: Interactive Ability Actions, the 50 shipped Core ability rules texts, Predator Tactics 0.1.0 compatibility, German/English localization integrity, persisted 1.0.x creature compatibility, and release metadata/packaging.

## Findings

### Interactive Ability Actions

The 1.1 data model resolves ranked creature DCs when an ability is materialized, so generated Blueprint interactions contain concrete DCs rather than unresolved `dcRank` placeholders. The compiler/runtime can render native PF2e inline checks and actions, and GM-only chat requests remain separate from passive rules text. Existing runtime tests cover item description controls, chat rendering, enrichment, and GM chat dispatch.

### Core ability rules text

All 50 shipped Core ability descriptions exist in both language catalogs and the dev.2 review made their rules text explicit. Representative abilities such as Pounce/Anspringen and Pack Hunter/Rudeljäger are permanently regression-tested. Save-based Core abilities carry matching structured save data and level-resolved interactions where applicable.

### Predator Tactics 0.1.0

Predator Tactics registers cleanly through the public ability-library API used by Creature Forge 1.1. The RC audit generated 384 creatures across 6 levels, 8 roles, and 8 predator-relevant categories with Core and Predator Tactics both default-enabled. Results: 0 invalid Blueprints, 0 validator warnings, 0 compilation failures, 0 unresolved ranked interaction DCs. All 25 Predator abilities appeared in the audit; Predator content represented about half of selected abilities, confirming the add-on density brake still works with this Core candidate.

### Localization

German and English catalogs contain the same 762 keys. Neither catalog has dotted parent/child string collisions, including the localization pattern that caused the 1.0.0 Foundry startup error.

### Persisted 1.0.x creatures

Representative Creature Forge 1.0.1 Blueprint v11 creatures, including normal, Dragon, and Mythic Caster examples, validate and compile under this RC. Opening them through the editor session rehydrates their Request v8 snapshot correctly. Blueprint v11 therefore remains readable even though newly generated 1.1 creatures use Blueprint v12.

### Release metadata and documentation

The review found one release-facing drift: `docs/API.md` still described the 1.0.0 Blueprint v11 / Content v10 stable contract even though the 1.1 development line uses Blueprint v12 / Content v11 for interactive ability metadata. The RC corrects this and adds a regression test tying README/API documentation to the shipped module version and schema constants.

## Public contracts

- Module/API: 1.1.0-rc.1
- Request schema: v8
- Blueprint schema: v12
- Content schema: v11
- Embedded Creature Editor contract: v13
- Runtime-status schema: v2

## Automated verification

- Permanent test suite: 192/192 passing.
- Syntax check: passing.
- Core + Predator Tactics audit: 384 generations, 0 invalid Blueprints, 0 warnings, 0 compilation failures, 0 unresolved ranked DCs.
- Legacy persistence audit: representative 1.0.1 Blueprint v11 creatures validate, compile, and rehydrate in the 1.1 editor session.
- DE/EN localization: 762/762 matching keys, 0 parent/child string collisions.

## Recommendation

1.1.0-rc.1 is ready for a final Foundry smoke test. No gameplay or generator rule changes were introduced after the already-tested dev.2 usability pass; the only RC correction is release/documentation hardening. If that smoke test is clean, the candidate can be promoted directly to 1.1.0 stable.
