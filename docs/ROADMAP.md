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

## 0.4.x - Auras and afflictions

- Aura recipe selection and Embedded Aura Editor.
- Actor-local Aura Forge assignment.
- Affliction recipe selection and Embedded Affliction Editor.
- Poison/injury-poison attack links.
- Dependency-aware rerolls.

## 0.5.x - Spellcasting

- Spell profiles and packages.
- Compendium spell indexing.
- Category/subtype/theme/role weighted spell selection.
- Innate, prepared, and spontaneous creature spellcasting.

## 0.6.x - Loot

- Concept-sensitive loot policy.
- Carried gear vs. corpse loot vs. hoard hints.
- Embedded Loot Forge.
- Direct Item Forge delegation for signature items.

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
