# PF2E Creature Forge 0.7.4 – Full Review & Reroll Hardening

## Scope

This pass reviews Creature Forge as one system rather than as a sequence of feature releases. The review covers request normalization and validation, GM Core creature tables, seeded generation, ability/signature/special-feature budgeting, rerolls and locks, compiler output, Effect/Aura/Affliction/Spell/Loot runtime boundaries, embedded-editor/API contracts, localization, release metadata, and the supplied optional Forge dependencies.

## Rules and generation review

The creature statistics remain driven by the GM Core creature-building tables for levels -1 through 24. The existing table tests and a full-range generation audit found no structural gaps or validator drift. The generated model continues to respect the intended trade-off model instead of maximizing every defense at once, and the validator retains warnings for combinations such as multiple extreme saves or coupled extreme offense.

A full balanced generation matrix covered every level from -1 through 24, all eight core roles, and all eighteen core creature categories: **3,744 generated Blueprints, zero invalid Blueprints, zero validator warnings**.

## Findings fixed

### 1. Single ability reroll could overspend the shared budget

Initial generation and whole-ability rerolls reserve spellcasting power before ordinary abilities are generated. `rerollAbilitySlot()` reserved Aura and Affliction power but omitted spellcasting. If a creature had already spent part of the shared budget on spellcasting, a single ability reroll could legally choose an ability that made the combined creature exceed the shared limit.

0.7.4 includes `spellcastingSpent` in the reserved feature cost, with a fallback to the current spellcasting entry for older Blueprints whose metadata does not yet contain that accounting field.

### 2. Earlier reroll slots could duplicate a later locked/preserved ability

Ability generation already reserved the **power cost** of future preserved slots, but only considered content IDs and unique families of abilities that had already been emitted. When rerolling an early slot, a later locked ability therefore existed in the budget calculation but not in the uniqueness calculation. The permissive fallback candidate pass made this more likely by dropping exclusion/family checks entirely.

0.7.4 reserves future preserved content IDs and unique families before picking the current slot and removes the permissive fallback. If no legal candidate remains, generation stops cleanly rather than violating a lock/uniqueness invariant.

## Runtime/compiler review

No new runtime defect was reproduced in the 0.7.4 pass. The 0.7.3 hardening remains intact:

- Effect refreshes preserve hosted Affliction markup.
- Area target mode resolves all selected targets.
- Executable area/save/target mechanics are validated before materialization.
- Actor runtime status distinguishes `ready`, `degraded`, `failed`, and `skipped`.
- Deferred loot keeps the PF2e 8.4-native persistence boundary while Loot Forge remains the generator.
- Signature mechanics with deliberate GM adjudication, such as Hydra head destruction/regrowth and Phoenix resurrection, remain explicit rather than hidden automation.

## Supplied Forge integration review

The current Creature Forge adapter expectations were checked against the supplied module builds:

| Integration | Supplied version | Result |
| --- | --- | --- |
| Critical Forge / Effect Forge | 1.0.1-rc.4 | `api.effects` validation/compile/create/apply/execute/compatibility and Effect Editor surfaces match |
| Aura Forge | 1.0.0-rc.3 | definition validation/create, `instances.assignDefinition`, and embedded Aura Editor match |
| Affliction Forge | 0.1.63 | definitions, references, template/library, runtime engine, trigger status, and embedded editor surfaces match |
| Item Forge | 0.0.37-rc.1 | `api.generate()` contract used for signature items is present |
| Loot Forge | 0.3.5 | creature inventory/loot generation and embedded/editor/materialization helper surfaces match |

No adapter change was required for those supplied versions.

## Automated evidence

- Permanent Node test suite: **171/171 passing**.
- JavaScript syntax check: all module scripts pass `node --check`.
- Full balanced generation matrix: **3,744** cases, zero invalid Blueprints, zero warnings.
- Representative reroll matrix: **1,008** generated creatures and **3,994** scoped rerolls across abilities, single ability slots, attacks, and defenses, with zero invalid Blueprints, shared-budget overruns, or duplicate unique families.
- Signature stress matrix: **90** generated signature concepts and **269** single-slot rerolls across Dragon, Troll, Vampire, Hydra, Phoenix, and elemental signatures, with zero invalid Blueprints, shared-budget overruns, or duplicate unique families.

## Compatibility and release state

No public data schema change is required:

- Request schema: v7
- Blueprint schema: v10
- Content schema: v10
- Embedded Creature Editor contract: v12
- Runtime-status flag schema: v2
- Module/API: 0.7.4

The remaining confidence boundary is a real Foundry/PF2e end-to-end smoke pass because isolated Node tests cannot instantiate actual Foundry documents, PF2e sheets, hooks, canvas targeting, or all five optional modules simultaneously. Based on the static API comparison and automated coverage, no blocker remains for that smoke pass.
