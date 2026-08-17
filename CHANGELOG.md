# Changelog

## 0.4.0 - Auras & Afflictions Integration

- Added optional concept-sensitive Aura and Affliction generation with independent `auto`, `none`, and `required` modes.
- Added `rare`, `normal`, and `high` special-feature frequency; automatic generation may deliberately produce no Aura and/or no Affliction.
- Added seeded category/subtype-aware probability and weighted selection for Aura/Affliction candidates.
- Added a shared special-feature power budget: selected Auras and Afflictions reserve power before ordinary abilities are generated.
- Added scoped Aura/Affliction/special-feature rerolls plus lock preservation.
- Added core Aura and Affliction starter libraries and public external `registerAuraLibrary()` / `registerAfflictionLibrary()` APIs.
- Added Aura/Affliction library controls to the Sources tab with standalone world defaults and embedded-host-local source behavior.
- Added Embedded Aura Forge and Affliction Forge editors in the same full-width subeditor workspace used by Effect Forge.
- Added actor-local Aura materialization through Aura Forge `instances.assignDefinition()` so generated Auras do not populate the global Aura Library.
- Added generated PF2E Affliction Action items and a manual **Apply affliction** runtime control delegated to Affliction Forge `engine.applyDefinition()`.
- Added public Aura/Affliction validation/application bridges and special-feature runtime APIs.
- Aligned core Aura definitions with the supplied Aura Forge schema v1 contract, including valid `turnStart` events and trigger-based instant damage.
- Aligned core Affliction definitions with the supplied Affliction Forge schema v2 contract and unlimited stage-effect duration owned by the Affliction Engine.
- Promoted request, Blueprint, and content schemas to v5; Embedded Creature Editor contract to v9; API/module version to 0.4.0.
- Expanded automated coverage to 99 tests.

## 0.3.8 - Ability Sources, Power Budget & Dependency Hardening

- Added selectable external ability libraries and world/host-local source selection.
- Added per-ability power costs, automatic/manual ability budgets, dependency validation, and budget-aware rerolls.
- Excluded abilities with missing Effect/Aura/Affliction dependencies before weighted selection.
- Preserved library provenance and power metadata through generation and compilation.

## 0.3.7 - Localization & Ability Presentation Regression Fix

- Hardened Creature Forge localization with an embedded DE/EN fallback catalog for package-owned keys, while continuing to use Foundry i18n for external/system content.
- Fixed the regression where unresolved package translations caused most of the Creature Forge UI to fall back to English and the Open/window title controls to show raw localization IDs.
- Restored localized generated ability names and descriptions in the editor and compiled PF2E Action items.
- Localized built-in ability trait chips and Effect timing labels instead of showing raw slugs such as `fear`, `mental`, `trigger`, or `failed-save`.
- Replaced the raw `pf2e-creature-forge` source marker on core ability cards with a localized `Creature Forge Core/Kern` label.
- Applied Effect definitions now receive their localized name, mechanical explanation, and localized originating ability name even if Foundry did not resolve the module language dictionary.
- Added regression coverage for missing/stale Foundry package localization, German ability compilation, and applied Effect explanation/source text.
- Promoted API/module version to 0.3.7.

## 0.3.6 - Applied Effect Explanations

- Added localized explanatory descriptions to all built-in Creature Forge EffectDefinitions.
- Applied effects now carry their explanation into the PF2E Effect item created by Effect Forge instead of showing an empty description.
- Manual runtime application appends a small localized source note naming the creature ability that applied the effect.
- Materialized runtime Effect resources also receive the localized explanation, while remaining ability-agnostic for safe reuse.
- Explicit descriptions edited through the Embedded Effect Editor continue to take precedence over the built-in description key.
- External effect content can opt into the same behavior through a `descriptionKey` on the registered effect resource.
- Embedded Effect Editor opening now resolves a description key into the current Foundry language when the stored definition has no explicit description.
- Promoted API/module version to 0.3.6.

## 0.3.5 - Effect Runtime Control UX

- Reworked generated ability runtime rows so the linked Effect, timing metadata, and executable apply action are visually separated.
- Promoted **Apply effect** to a high-contrast red/gold action button with stronger hover, focus, and disabled states.
- Added a framed linked-effect reference chip and a compact timing badge for faster scanning on PF2E NPC sheets.
- Localized built-in runtime timing values (`after-use`, `trigger`, `failed-save`, `on-hit`, and `on-success`) instead of exposing raw English slugs.
- Kept the runtime layout responsive: on narrow sheets the apply action expands to a full-width control instead of crowding the linked-effect row.
- Kept runtime behavior and Effect Forge application semantics unchanged.
- Promoted API/module version to 0.3.5.

## 0.3.4 - Runtime Localization & Navigation Fix

- Localized EffectDefinitions immediately before manual application so applied effects use the active Foundry language.
- Replaced the former navigation-like apply control with a real `button[type=button]`.
- Captured runtime apply clicks before PF2E/Foundry sheet navigation handlers can interpret them.
- Added regression coverage for localized application and navigation-free runtime controls.
- Promoted API/module version to 0.3.4.

## 0.3.3 - Effect Materialization & Manual Runtime

- Added post-creation materialization of ability-linked EffectDefinitions through Critical/Effect Forge.
- Persistent linked effects now receive real world PF2E Effect Items in a dedicated `PF2E Creature Forge – Runtime Effects` folder instead of remaining Blueprint-only references.
- Rewrote generated NPC ability descriptions after materialization with actual Foundry `@UUID` links to the linked Effect items.
- Added a manual **Apply effect** control directly beside each linked effect in generated ability descriptions.
- Added target resolution for `self`, singular selected-target, and plural selected-target application modes.
- Routed manual application through Effect Forge `effects.apply()` so persistent and instant components continue to use the canonical Effect Engine.
- Added runtime source provenance on materialized world effect Items and automatic cleanup when the originating Actor is deleted.
- Exposed `api.runtime` operations for resolve/apply/materialize/refresh/cleanup plus Effect Forge `toItemSources`, `createItem`, and `createItems` bridge methods.
- Kept actor creation resilient when Effect Forge materialization is unavailable: ability references remain readable, while runtime apply controls are only emitted when the Effect API is available.
- Added automated runtime/materialization coverage and expanded the suite to 73 tests.
- Promoted API/module version to 0.3.3.

## 0.3.2 - Effect Editor Layout & Scroll Hardening

- Fixed the Creature Editor jumping to the top after closing an embedded ability Effect Editor.
- Prevented the hidden creature scroll element used during effect mode from overwriting the previously captured tab scroll position with a synthetic `0`.
- Kept return-to-creature behavior stable for Effect Editor close and other re-renders originating from effect mode.
- Refined the wide Effect Editor host workspace and let Critical Forge 1.0.1-rc.4 own its embedded palette, panel framing, field borders, button styling, and component-type colors.
- Increased the nested Effect Editor content width and kept component controls visually grouped instead of stretching small component fields across the entire workspace.
- Promoted the Embedded Creature Editor contract to v7 and API/module version to 0.3.2.

## 0.3.1 - Embedded Effect Editor UX

- Reworked ability-effect editing into a dedicated Creature Editor workspace instead of rendering the full Effect Editor inline beneath the ability list.
- Kept the Creature Forge tabs and persistent bottom action footer visible while an effect is being edited.
- Switched the public Embedded Effect Editor request to compact layout mode.
- Presented Effect Forge Basic Data and Duration side by side at wider host sizes, with Components spanning the full width below them.
- Added a fixed effect-workspace header with a clear "Back to creature" action and live-update hint.
- Preserved the previous creature-tab scroll position when opening and closing effect editing.
- Closing or switching Creature Forge tabs now cleanly unmounts the nested Effect Editor.
- Promoted the Embedded Creature Editor contract to v6 and API/module version to 0.3.1.

## 0.3.0 - Ability Engine & Effect Forge Integration

- Added schema-v3 ability-generation controls (`mode`, `count`, `complexity`, and focus tags).
- Added a seeded weighted Ability Engine using category, subtype, role, level, focus, and synergy metadata.
- Added whole-ability and single-slot rerolls, reroll-history integration, and per-ability locks.
- Added an initial localized core ability library plus reusable Effect Forge schema-v2 effect definitions.
- Added effect resource de-duplication: abilities reference neutral `resources.effects` definitions by stable content id.
- Added external ability/effect bundle support through the existing public Content Registry with source provenance.
- Added public Effect Forge bridge calls for validate, analyze, compile, item-source conversion, apply, instant execute, and compatibility checks.
- Embedded Critical Forge's public Effect Editor directly inside the Creature Editor for referenced ability effects.
- Promoted the Embedded Creature Editor contract to v5 with host-controllable `effectEditing` capability.
- Compiled generated abilities to PF2E action items and preserved application metadata in Creature Forge flags for later runtime trigger work.
- Promoted request, blueprint, and content schemas to v3 and the public API/module version to 0.3.0.
- Expanded automated coverage to 68 tests.

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
