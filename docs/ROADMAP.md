# Roadmap

## 0.1.0 - Architecture Foundation ✅

- Public API and schema contracts.
- Seeded random service.
- Content registry and external bundles.
- Embedded editor surface.
- Base defensive tables and road-map roles.
- Forge integration adapters.

## 0.1.1 - Core Statistics & Attack Engine ✅

- Ability modifier table and six generated ability modifiers.
- Role-derived ability profiles.
- Attack modifier and attack damage tables.
- One-attack / two-attack profiles.
- Stronger attack with lower accuracy vs. weaker attack with higher accuracy.
- Melee/ranged offense profiles and request overrides.
- Scoped attack rerolls.
- PF2E embedded strike compilation.

## 0.1.2 - Embedded Editor & Layout Hardening ✅

- Larger standalone ApplicationV2 host window.
- Embedded Creature Editor contract v2.
- Host-neutral root-scoped event/form handling.
- Editor-owned scroll region.
- Persistent bottom action footer.
- Scroll preservation across editor rerenders.
- Multi-host-ready `element`, modes, layouts, and mount sizing contract.

## 0.1.3 - Attack Localization ✅

- Locale-neutral core attack identifiers.
- German/English attack-name localization in editor and compiled PF2E strikes.
- Localized damage-type presentation in attack previews.
- Backward-compatible localization of 0.1.1/0.1.2 core attack fallback names.

## 0.1.4 - Skills, Movement & Senses ✅

- Skill rank/value generation.
- Role/category/subtype skill affinities.
- Movement modes and concept-sensitive speeds.
- Senses and Perception details.
- Skill/movement/sense consistency diagnostics and PF2E NPC compilation.

## 0.2.0 - Categories, Subtypes & Defensive Affinities ✅

- Category/subtype compatibility metadata and editor selection.
- Implied subtypes and granted traits.
- Level-scaled resistances, immunities, and weaknesses.
- Core affinity profiles for major creature concepts and structural subtypes.
- Automatic HP tradeoffs/compensation for defensive affinities.
- Manual overrides, provenance, conflict resolution, locks, and scoped rerolls.
- External category/subtype affinity providers through the public content registry.
- PF2E NPC compilation of IWR arrays.

## 0.2.1 - Compendium Sources & Category/Subtype Discovery ✅

- Actor/NPC compendium scanner with cached trait indexing.
- Independent category and subtype source selections.
- Request-local source filtering plus standalone world defaults.
- Category discovery from creature-type traits and subtype discovery from observed NPC traits.
- Source-aware registry resolution safe for multiple embedded editor instances.

## 0.2.2 - Source Tab & Editor UX ✅

- Move category/subtype compendium selection into a dedicated Sources tab.
- Preserve standalone world defaults and embedded host-local source policy.
- Keep Generate/Reroll/Create Actor footer visible across tabs.
- Preserve independent scroll positions per editor tab.

## 0.2.x - Category/source expansion

- Additional curated category/subtype definitions from selected sources.
- Required/preferred capability metadata shared with the later ability selector.

## 0.3.3 - Effect Materialization & Manual Runtime ✅

- Materialize referenced persistent Effect Forge definitions as reusable world PF2E Effect resources after NPC creation.
- Rewrite generated ability Items with real UUID references once runtime resources exist.
- Add manual Apply controls using ability target metadata (`self`, selected target, selected targets).
- Route application through Effect Forge so persistent and instant components use the canonical engine.
- Track runtime resource provenance on Actor/world Items and clean resources up when the source Actor is deleted.
- Expose runtime materialize/refresh/apply/cleanup operations through the public API.

## 0.3.2 - Effect Editor Layout & Scroll Hardening ✅

- Restore the exact creature-tab scroll position after closing nested effect editing.
- Ignore hidden effect-mode scroll containers when capturing tab scroll state.
- Consume the self-themed Critical Forge 1.0.1-rc.4 Embedded Effect Editor surface with clearer panels, borders, field colors, buttons, and component accents.
- Embedded Creature Editor contract v7.

## 0.3.1 - Embedded Effect Editor UX ✅

- Dedicated wide workspace for nested Effect Forge editing.
- Compact two-column Basic Data / Duration layout with full-width components.
- Persistent Creature Forge footer and clean return to the previous creature scroll position.
- Embedded Creature Editor contract v6.

## 0.3.0 - Ability Engine & Effect Forge Integration ✅

- Ability recipe/content schema and localized starter library.
- Weighted category/subtype/role/level/focus selection with synergy metadata.
- Seeded section/slot rerolls and per-ability locks.
- De-duplicated referenced Effect Forge resources.
- Embedded public Effect Editor.
- Effect Engine validate/analyze/compile/toItemSource/apply/execute/compatibility bridge.
- External ability/effect content bundles and PF2E action-item compilation.

## 0.3.x - Ability expansion

- Ability budget/power analysis beyond count/complexity.
- Compendium ability normalization/source discovery.
- Broader curated ability library and dependency diagnostics.
- Automatic runtime execution of ability application triggers (manual runtime available since 0.3.3).


## 0.3.8 - Ability Sources, Power Budget & Dependency Hardening ✅

- Selectable external ability libraries through the public Content API.
- Ability-library selection in the Sources tab with world/host-local persistence semantics.
- Per-ability power costs and automatic/manual power budgets.
- Dependency validation for referenced effects, auras, and afflictions.
- Dependency-invalid abilities excluded before weighted selection.
- Lock-aware budgeted rerolls and duplicate-family hardening.

## 0.4.0 - Auras & Afflictions Integration ✅

- Optional concept-sensitive Aura/Affliction generation with `auto | none | required` modes.
- Rare/normal/high special-feature frequency and deterministic seeded variation.
- Shared power budget with ordinary abilities.
- Core Aura/Affliction libraries plus selectable external libraries in the Sources tab.
- Scoped rerolls, locks, provenance, and required-feature diagnostics.
- Embedded Aura Forge and Affliction Forge editors in the canonical Creature Editor.
- Actor-local Aura Forge assignment so generated Auras do not pollute the global library.
- PF2E Affliction Action items plus manual Affliction Forge runtime application.
- Contract compatibility with supplied Aura Forge schema v1 and Affliction Forge schema v2.

## 0.4.1 - Affliction Delivery & Aura/Affliction Runtime Hardening ✅

- Assign generated Afflictions to compatible attacks/abilities and delegate hosted triggers to native Affliction Forge references.
- Materialize actor-local templates for generated definitions and harden Aura validation/reconciliation.

## 0.4.3 - Affliction Runtime Localization Fix ✅

- Synced the embedded DE/EN fallback catalog with all shipped runtime Affliction delivery keys.
- Localized host/delivery/trigger/application strings on generated PF2E NPC sheets.
- Added full language-catalog parity regression coverage.

## 0.4.2 - Affliction Library Bridge & Delivery Fix ✅

- Bridge actual Affliction Forge provider/world libraries into Creature Forge source selection.
- Preserve canonical template UUID provenance and detach only after editing.
- Keep library level/DC intact rather than rescaling published definitions.
- Harden attack/ability host resolution and verify native Affliction references after persistence.
- Fail closed to manual application with visible diagnostics when automatic delivery cannot be verified.

## 0.4.x - Special-feature hardening

- Bind selected Afflictions to compatible attacks/abilities or exposure mechanisms.
- Broader Aura/Affliction libraries and additional external dependency diagnostics.
- Optional automatic runtime triggers after the manual application paths are proven.


## 0.5.2 - Core Review & Runtime Hardening ✅

- Isolate optional post-create Effect, Aura/Affliction, and spell runtime failures and expose consolidated Actor/runtime diagnostics.
- Add ownership-aware, idempotent spell refresh that preserves manual spells and prevents ghost prepared-slot references.
- Harden external actor-local Aura ownership cleanup and Affliction reference/host-description refresh behavior.
- Expand Blueprint identity/runtime-reference validation.
- Add a broad level/role/category regression matrix and explicit partial-runtime tests.

## 0.5.1 - Required Special Feature Budget Fix ✅

- Required Auras/Afflictions may overrun an exhausted shared budget with explicit diagnostics, matching required spellcasting semantics.
- Automatic special features remain budget constrained.
- Regression coverage for required spellcasting + required Affliction.

## 0.5.0 - Spellcasting & Thematic Spell Selection ✅

- Optional concept-sensitive spellcasting with `auto | none | required`.
- GM Core spell DC/attack bands and level-appropriate highest spell rank.
- Selectable spell-compendium indexing with rituals/focus spells excluded from the normal pool.
- Category/subtype/theme/role weighted tradition and spell selection.
- Innate, prepared, and spontaneous creature spellcasting.
- Focused/standard/broad repertoires plus seeded whole-entry and individual-spell rerolls/locks.
- Shared power-budget participation before Aura/Affliction/ability selection.
- PF2E NPC spellcasting-entry compilation and post-create spell Item materialization.
- Public `api.spells`, spell-source preparation/status, and external `spellProfile` content.
- Embedded Creature Editor contract v11, request schema v6, Blueprint/content schemas v8.

## 0.5.x - Spellcasting hardening

- Focus-spell generation and Focus Point policy.
- Optional hand-curated spell packages/signature spell slots.
- Broader semantic spell tagging and source diagnostics.
- Additional PF2E runtime edge-case coverage for spontaneous/prepared entries.

## 0.6.3 - Deferred Loot Materialization & Sheet Entry Fix ✅

- Explicit Beute/Loot sheet-header control for deferred Creature Forge loot.
- PF2E-compatible salvage treasure source schema and sanitized copied hoard item sources.
- Fail-safe Loot Actor materialization and non-fatal post-create UI/provenance steps.

## 0.6.2 - Deferred Loot Label & UX Cleanup ✅

- Clarify the combined deferred-loot action as **Beute erzeugen** / **Create loot**.
- Keep the dedicated Creature Forge loot-panel title and explicit salvage/hoard actions.
- Keep shipped and embedded fallback localizations synchronized.

## 0.6.1 - Deferred Loot UX ✅

- GM-only NPC-sheet summary for deferred salvage and hoard/environment treasure.
- Explicit per-channel or combined Loot Actor creation.
- Persisted source-NPC materialization references with reopen/recreate handling.
- No automatic extra Actor creation.

## 0.6.0 - Loot, Equipment & Signature Items Integration ✅

- Concept-sensitive `auto | none | required` loot policy.
- Separate carried equipment, signature item, body salvage, and hoard/environment channels.
- Loot Forge delegation for equipment/hoards and Item Forge delegation with fallback for signature items.
- Host-local Item-compendium sources.
- Carried-loot Actor runtime plus deferred Loot Actor creation for salvage/hoards.
- Whole/channel rerolls and channel locks.
- Embedded Creature Editor contract v12; request schema v7; Blueprint/content schemas v9.

## 0.6.x - Loot hardening

- Optional embedded Loot Forge editing workflow for hand-tuning a generated hoard/inventory.
- Stronger semantic equipment-to-generated-strike binding where a carried weapon should visibly define an NPC attack.
- Additional salvage profiles supplied by external content packs.

## 0.7.x - Content packs

- Larger core ability/aura/affliction library.
- External theme packs.
- Source diagnostics and provenance UI.

## 0.8.x - Encounter Forge readiness

- Stable embedded editor contract.
- Multi-instance stress tests.
- Variant generation.
- Host-controlled source profiles.
- Draft/commit workflows.

## 1.0

- Release hardening, migration policy, API stability commitment, and complete documentation.


## 0.6.4 - Deferred Loot PF2e 8.4 Compatibility Fix ✅

PF2e 8.4 strict treasure persistence, native deferred-loot materialization, and reliable ApplicationV1 NPC-sheet Beute/Loot entry.

## 0.6.5 - Deferred Loot Dialog & Sheet Layout Fix ✅

- Keep PF2e NPC sheet DOM untouched by deferred-loot UI.
- Open deferred salvage/hoard controls in a dedicated GM-only DialogV2 from the **Loot / Beute** header control.
- Preserve 0.6.4 PF2e 8.4 Treasure-schema normalization and materialization fixes.


## 0.7.0 - Expanded Creature Abilities & Signature Powers ✅

- Expanded category-specific core ability content.
- Added signature-power metadata/resolution with elemental Dragon Breath as the first dynamic implementation.
- Added GM Core limited-use area-damage scaling, dynamic save/area/recharge mechanics, generated Effect Forge damage resources, signature rerolls, and auto-budget allowance.
- Request schema v7; Blueprint/content schemas v10; Embedded Creature Editor contract v12.

## 0.7.1 - Inline Area Templates ✅

- Native PF2E inline templates for generated area abilities.
- Explicit area geometry for static core area powers and dynamic Dragon Breath.

## 0.7.2 - Signature Powers Expansion ✅

- Troll Regeneration, Vampiric Drain, Hydra Heads, Phoenix Rebirth, and affinity-aware Elemental Retaliation.
- Signature priorities, generated Effect Forge resources, and structured signature mechanics.

## 0.7.3 - Ability & Signature Runtime Review / Hardening ✅

- Preserve hosted Affliction markup across independent Effect refreshes.
- Harden area target semantics and executable ability-mechanic validation.
- Promote nested runtime warnings to consolidated Actor runtime status with `degraded` state.
- Correct release/download metadata and stale editor-contract documentation.
- Permanent test suite: 169 passing tests. One-off review audit: 1,008 core level/role/category generations plus 63 signature-interaction rerolls, all structurally valid.


## 0.7.4 - Full Review & Reroll Hardening ✅

- Full level/role/category generation audit and representative scoped reroll stress pass.
- Shared spellcasting/ability budget hardened for single-slot rerolls.
- Future locked/preserved ability identities and unique families are now reserved during earlier-slot rerolls.
- Current Affliction/Aura/Effect/Item/Loot Forge public integration surfaces rechecked against the supplied module builds.
- Permanent suite: 171 passing tests.


## 0.8.0 - Mythic Creatures ✅

- War of Immortals mythic monster adjustment progression.
- Mythic Ambusher/Laurer, Brute/Schläger, Caster/Zauberwirker, and Striker/Plänkler templates.
- Mythic editor controls, automatic role mapping, 3-point PF2E mythic resource, and compiled mythic action items.
- Request schema v8, Blueprint schema v11, Embedded Creature Editor contract v13.
- Permanent suite: 177 passing tests.

## 0.9.0-rc.1 - Release Candidate & Final Integration Review ✅

- Release metadata alignment plus permanent version/download regression guard.
- Persisted Blueprint/editor request rehydration with legacy request-snapshot normalization.
- Capability-complete diagnostics for optional Affliction/Aura/Effect/Item/Loot Forge integrations and recheck against the supplied current module builds.
- Mythic-aware extreme-skill validator refinement.
- No schema bump: Request v8, Blueprint v11, Content v10, Embedded Creature Editor v13, runtime-status v2.
- Permanent suite: 183 passing tests. Representative audit: 1,008 normal generations + 504 Mythic generations + 504 compilations + 1,728 scoped rerolls, zero invalid Blueprints and zero warnings.

