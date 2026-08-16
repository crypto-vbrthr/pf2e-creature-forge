# Changelog

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
