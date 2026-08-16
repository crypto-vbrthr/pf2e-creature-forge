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

## 0.3.x - Abilities and Effect Forge

- Ability recipe schema.
- Weighted selection and synergy graph.
- Ability budget and complexity.
- Embedded Effect Editor.
- Effect Engine compile/apply integration.
- Granular reroll and locks.

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
