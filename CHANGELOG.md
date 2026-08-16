# Changelog

## 0.2.2 - Source Tab & Editor UX

- Moved category/subtype compendium selection out of the main creature form into a dedicated **Sources** tab.
- Promoted the Embedded Creature Editor contract to v4 and exposed `creature` / `sources` tabs plus `currentTab` and `setActiveTab()`.
- Kept the source tab inside the canonical embedded surface so Encounter Forge and other hosts receive the same source UI automatically.
- Preserved world-default source persistence for the standalone host and request-local source selections for embedded hosts.
- Preserved independent scroll positions when switching tabs and kept the persistent bottom action footer visible across tabs.
- Added responsive tab/source-panel styling and updated DE/EN localization/documentation.

## 0.2.1 - Compendium Sources & Category/Subtype Discovery

- Added asynchronous scanning of selected Actor/NPC compendiums using lightweight index fields for document type and creature traits.
- Added separate category-source and subtype-source selections to the Embedded Creature Editor.
- Added world-default source persistence for the standalone Creature Forge while keeping embedded-host source selections request-local by default.
- Added source-aware registry resolution so scanned compendium entries are visible only to requests that selected their source; core and external registered content remain available.
- Added category discovery from recognized creature-type traits and subtype discovery from other observed NPC traits.
- Added observed category compatibility metadata and occurrence counts to discovered subtype definitions.
- Added compendium discovery provenance and cached source scanning.
- Added `api.generateAsync()`, `api.sources.discover()`, `ensure()`, `listContent()`, source defaults, status, cache controls, and source-preparation diagnostics.
- Preserved the existing generic `api.sources.listCompendiums({ documentName })` API.
- Promoted the Embedded Creature Editor contract to v3 for host-aware source controls.
- Expanded automated coverage to 57 tests.

## 0.2.0 - Categories, Subtypes & Defensive Affinities

- Added category/subtype compatibility metadata, implied subtypes, and granted traits.
- Added level-scaled immunities, resistances, and weaknesses with seeded selection, manual overrides, provenance, conflicts, and scoped rerolls.
- Added defensive HP compensation/tradeoffs and PF2E NPC IWR compilation.
- Added external category/subtype affinity providers through the public content registry.

## 0.1.4 - Skills, Movement & Senses

- Added the GM Core creature skill table for levels -1 through 24, including seeded values inside low-skill ranges.
- Added role-, category-, subtype-, and ability-aware skill selection with concept filters for animals, oozes, and mindless creatures.
- Added configurable skill count, primary skill rank, and preferred skill hints to the generation request and Embedded Creature Editor.
- Added land, climb, swim, fly, and burrow movement generation with explicit overrides and concept-sensitive automatic choices.
- Added low-light vision, darkvision, and scent generation with explicit auto/on/off controls and configurable scent range.
- Added scoped rerolls for skills, movement, and senses while preserving unrelated Blueprint sections and individually locked entries where applicable.
- Added Blueprint/request validation for skills, alternate movement, senses, redundant vision, excessive high/extreme skill bands, and malformed values.
- Added PF2E NPC compilation for generated skills, Perception senses, land Speed, and alternate Speeds.
- Added localized skill, movement, sense, and acuity presentation in the Embedded Creature Editor.
- Expanded automated coverage to 43 tests.

## 0.1.3 - Attack Localization

- Added stable localization keys to all generated core attack names.
- Localized generated attack names in the Embedded Creature Editor.
- Localized generated attack names when compiling PF2E NPC strike items.
- Localized damage-type labels in the attack preview while retaining PF2E damage slugs internally.
- Localized the attack reroll tooltip.
- Kept attack names locale-neutral in CreatureBlueprints through `nameKey` plus an English fallback name.

## 0.1.2 - Embedded Editor & Layout Hardening

- Increased the standalone Creature Forge default window size from 1040×760 to 1280×860.
- Added migration for the legacy default-sized saved window state so upgrades actually open at the larger size.
- Promoted the Creature Editor embedded contract to v2.
- Kept the standalone ApplicationV2 as a thin host of the same public Embedded Creature Editor used by external modules.
- Scoped field lookup and event listeners to the embedded editor root for safer composition inside larger host windows.
- Added an editor-owned internal scroll region instead of scrolling the outer standalone shell.
- Moved Generate, Reroll, and optional Create Actor into a persistent bottom editor footer so primary actions remain visible while content scrolls.
- Preserved editor scroll position across rerolls and regeneration.
- Added public editor `element`, `modes`, `layouts`, and optional `mount(..., { minHeight })` host controls.
- Added responsive footer behavior for narrow embedded hosts.

## 0.1.1 - Core Statistics & Attack Engine

- Added GM Core ability-modifier tables for levels -1 through 24.
- Added all six generated ability modifiers and role-based ability profiles.
- Added concept defaults for mindless Intelligence and animal Intelligence.
- Added GM Core attack-bonus and attack-damage tables for levels -1 through 24.
- Added role-driven offense profiles for all core road-map roles.
- Added one-strike and two-strike generation.
- Added complementary two-strike logic: accurate/lower-damage vs. heavy/lower-accuracy.
- Added melee/ranged attack mode, attack-rank, damage-rank, and damage-type request controls.
- Added deterministic attack-form variation by category and seed.
- Added scoped attack and ability rerolls while preserving unrelated statistics.
- Added Blueprint validation for malformed strikes, coupled extreme attack/damage, and non-complementary attack pairs.
- Added PF2E NPC strike compilation as embedded `melee` items.
- Added ability and strike previews to the Embedded Creature Editor.
- Updated public API/module version to 0.1.1.
- Expanded test coverage to 30 tests.

## 0.1.0 - Architecture Foundation

- Started PF2E Creature Forge as a new module rather than a refactor of Monster Forge.
- Added public API version 0.1.0.
- Added request, blueprint, and content schema version 1.
- Added seeded deterministic RNG service with weighted choice, shuffle, chance, and forked streams.
- Added official creature-building AC, HP, save, and Perception rank tables for levels -1 through 24.
- Added GM Core road-map role presets for Brute, Magical Striker, Skill Paragon, Skirmisher, Sniper, Soldier, and Spellcaster.
- Added the extensible content registry and content-bundle contract.
- Added core creature categories and a small core subtype/trait set.
- Added Embedded Creature Editor contract v1.
- Added standalone Creature Forge ApplicationV2 shell and Actor Directory launch button.
- Added Effect/Aura/Affliction/Item/Loot Forge capability discovery.
- Added compendium source discovery.
- Added preliminary PF2E NPC compilation and actor creation.
- Added DE/EN localization.
- Added architecture/API/roadmap documentation and foundation tests.
