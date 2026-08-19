# PF2E Creature Forge 0.9.0-rc.1 – Release Candidate & Final Integration Review

## Scope

This pass treats the complete 0.8.x Creature Forge as a release candidate rather than adding another feature family. The review covers release metadata, Request/Blueprint persistence and editor round-trips, validation, normal and Mythic generation, compilation, scoped rerolls, localization-facing contracts, optional Forge-module capability detection, and the supplied integration builds.

## Findings fixed

### 1. Release metadata drift

The 0.8.2 manifest advertised module version `0.8.2` but still pointed `download` at the `v0.8.1` release asset. The RC aligns module, package, API constant, release tag, and download URL and adds a permanent release-metadata test so the same drift is caught before packaging. Foundry compatibility remains minimum/verified v14 with no speculative maximum, and the PF2e system minimum remains 8.4.0.

### 2. Persisted Blueprint editor rehydration

An Embedded Creature Editor opened with an existing Blueprint but without a separate Request retained the Blueprint itself while initializing its controls from defaults. The session now derives its initial Request from `blueprint.metadata.requestSnapshot` when an explicit Request is absent. The snapshot is passed through normal Request creation/normalization, so older pre-Mythic schema-v7 snapshots reopen safely with current schema-v8 Mythic defaults rather than requiring a bespoke migration path.

### 3. Optional integration capability diagnostics

The integration bridge previously treated any exposed `module.api` object as fully ready even if Creature Forge's required methods were missing. RC status keeps `ready` as the API-exposure signal for compatibility, and adds `complete`, `capabilities`, and `missingCapabilities`. The editor uses `complete` for the fully-ready state, so an active but incomplete optional integration is visible as partial instead of green.

The capability contracts were also tightened where Creature Forge actually relies on a surface: Aura reconciliation, Affliction template application/reconciliation, and Item Forge `generate()` are now explicitly checked.

### 4. Mythic extreme-skill validation

War of Immortals Mythic role templates can deliberately promote a role skill to extreme. A valid Mythic creature could therefore have one ordinary extreme skill from its base road map plus one template-mandated extreme skill and trigger the generic `MANY_EXTREME_SKILLS` warning. The validator now excludes explicitly `mythicAdjusted` skills from that ordinary warning while continuing to warn on multiple non-Mythic extreme skills.

## Supplied Forge integration review

| Integration | Supplied version | Contract result |
| --- | --- | --- |
| Critical Forge / Effect Forge | 1.0.1-rc.4 (Effect API 0.9.6) | Effect validation/analyze/compile/materialization/apply/execute/compatibility plus embedded Effect Editor surfaces match |
| Aura Forge | 1.0.0-rc.3 (API 0.6.0) | definition create/validate, assignment/reconciliation, and embedded Aura Editor surfaces match |
| Affliction Forge | 0.1.63 (API 0.1.0) | definitions, template/runtime application, reconciliation, references/libraries/templates, trigger status, and embedded editor surfaces match |
| Item Forge | 0.0.37-rc.1 (API v1) | public `generate(request)` contract and Creature Forge signature-item categories match |
| Loot Forge | 0.3.5 | creature inventory/loot generation, Actor materialization, and embedded editor surfaces match |

No supplied module requires an adapter rewrite for this release candidate. Missing methods are now diagnosed explicitly instead of being inferred from API-object presence.

## Schema and compatibility freeze

The final-integration fixes do not require a data-contract bump:

- Request schema: v8
- Blueprint schema: v11
- Content schema: v10
- Embedded Creature Editor contract: v13
- Runtime-status flag schema: v2
- Module/API: 0.9.0-rc.1
- Foundry: minimum/verified 14
- PF2e: minimum 8.4.0

The Blueprint request-snapshot normalization is deliberately backward-safe rather than a persisted Blueprint schema migration.

## Automated evidence

- Permanent Node test suite: **183/183 passing**.
- JavaScript syntax/check task: pass.
- Representative normal generation audit: **1,008** cases.
- Representative Mythic generation audit: **504** cases.
- Representative compilation audit: **504** compiled NPC sources.
- Scoped reroll audit: **1,728** rerolls.
- Combined sampled audit result: **zero invalid Blueprints and zero validator warnings**.

The sampled RC audit deliberately mixes levels from -1 through 24, all core creature categories, all normal Creature Forge roles, all four Mythic templates, compilation, and attack/defense/ability reroll paths. It complements the earlier exhaustive 0.7.4 normal-generation and 0.8.0 Mythic-generation matrices rather than replacing them.

## Release-candidate boundary

No code review or isolated Node test can replace an actual Foundry v14 / PF2e 8.4+ world. The remaining RC gate is therefore a live install/smoke pass: open the standalone and embedded editor, reopen at least one persisted Creature Forge Actor/Blueprint, create ordinary and Mythic NPCs, exercise representative rerolls, and verify optional Effect/Aura/Affliction/Item/Loot integrations in the real Foundry runtime.

From the static review, supplied-module contract comparison, regression suite, and generation/compile/reroll audits, no code-level blocker remains for that live RC smoke test.
