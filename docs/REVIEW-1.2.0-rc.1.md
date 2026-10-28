# Creature Forge 1.2.0-rc.1: Release Candidate Review

## Basis and scope

Based on user-provided Creature Forge 1.2.0-dev.1, whose scroll panels, section locks, scoped rerolls and +/- controls passed a Foundry smoke test. This RC focuses on section preservation, numeric persistence, and real provider-library compatibility. It is **not** yet a Foundry-tested final RC.

## Review finding: HP and defensive-affinity lock interaction

The 1.2.0-dev.1 implementation recalculated HP compensation when rerolling defensive affinities, even if the **HP section itself was locked**. Conversely, rerolling the **defenses** with defensive affinities locked could retain a newly generated HP adjustment instead of the locked affinities' adjustment. Both could cause internal HP bookkeeping to diverge from the selected defensive traits and violate the user's lock expectations.

The RC reconciles all relevant cases:

- Reroll defensive affinities while **HP locked**: keep the current HP total, apply the new affinity compensation, adjust internal base HP accordingly.
- Reroll defenses while **affinities locked**: keep affinity definitions and their HP compensation, reconcile the regenerated HP total to the preserved adjustment.
- Reroll defenses while **HP locked**: preserve the HP total even if affinities change, keeping their compensation reflected in base HP.

Three regression tests cover these corner cases. HP section locks deliberately protect the displayed maximum HP rather than freezing derived compensation metadata when affinity profiles change.

## Generator/provider integration audit

Used the **actual released ability-library definitions** from Predator Tactics **0.1.1** and Brutal Physiology **0.1.0**, registered alongside the Core library. The audit covered 6 levels (-1, 2, 5, 9, 14, 20), 8 roles and 12 categories: **576 distinct initial blueprints**. Tests included:

- Blueprint schema validation and NPC Actor compilation.
- Unique selected ability families and mixed-library selection.
- Simultaneous locks of attributes, skills, strikes, abilities and affinities followed by full reroll with a changed concept.
- Scoped rerolls of attributes, skills, movement, senses and strikes, asserting unrelated attack/stat data remain unchanged.
- Preservation of source blueprints (no in-place mutation during reroll).

**Results:** 576 valid blueprints, 576 successful compilations, zero validator warnings, zero family duplicates and zero lock failures. 2,880 scoped-reroll checks passed. Ability selection comprised 997 Core, 510 Predator Tactics and 741 Brutal Physiology selections. These figures describe this audit matrix, not a universal recommended percentage.

## UI and persistence

- Two independent concept/generated scrollports and preserved scroll positions remain part of the shared embedded editor and standalone host.
- 13 lockable sections, individual entries and numeric path whitelists retain their development behavior.
- Adjusted numbers are stored on the blueprint and included in NPC compilation; edits are not silently propagated to unrelated attributes/skills.
- Whole-creature reroll preserves locks while **Generate** is an intentional fresh start. Over-budget locked content may legitimately produce a warning rather than being discarded.
- Existing 1.0.x blueprints and the stable Creature Forge 1.1.1 data contracts are covered by the standard regression suite; schemas are unchanged in this RC.

## Packaging and checks

- Module ID `pf2e-creature-forge` remains stable.
- Requires Foundry VTT 14 and PF2e 8.4.0 or higher.
- Request schema v8, Blueprint v12, Content v11, Embedded Editor v14.
- RC version `1.2.0-rc.1`; version-bearing files, manifest tag and download path aligned.
- Automated suite: **206/206 tests passed**; `npm run check` passed.

## Still recommended in Foundry

Confirm in a live world that rerolling **Defenses** while **Defensive Affinities** is locked, and rerolling **Defensive Affinities** while **HP** is locked, retain the expected totals. Also check both add-ons remain selectable and produce compiled NPC actions. A real Foundry/PF2e integration smoke test remains necessary before promoting to stable 1.2.0.
