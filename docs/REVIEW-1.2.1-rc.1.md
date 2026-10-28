# Creature Forge 1.2.1-rc.1 — release candidate review

## Scope

Release-candidate promotion of the user-reviewed 1.2.1-dev.3 without gameplay, generator, editor, or UI changes beyond those already present in dev.3.

- Chat controls for linked effects: click selected target / drag onto token, with manual save/outcome adjudication (from dev.1).
- Focus tags: 23 grouped checkboxes, accessible compact positioning, additional free-form tags, and existing +20 weighted preference per matching focus (dev.2/dev.3).
- Abilities requiring skills receive skill modifiers without overwriting existing values, and explicit melee/ranged tags respect generated attack profiles (dev.2).
- Localization of effect application timing `critical-failure` (dev.2).
- Foundry 14 and PF2e minimum 8.4.0 manifest compatibility unchanged. Public schemas: Request v8, Blueprint v12, Content v11, Embedded Creature Editor v14, runtime-status v2.

## Automated validation

- 224/224 bundled Node tests passed; JavaScript syntax check passed.
- Tested with Battlefield Control 0.1.0-dev.7 content library registered into the Creature Forge registry. **This tests integration of the content, not Foundry's module dependency resolver.**
- 480 category/level/role generations; 480 blueprints valid; 480 actor sources compiled.
- 859 Battlefield Control abilities selected; 59 explicit required skill checks with zero missing skills.
- Zero inappropriate melee-tagged abilities on ranged-only attack profiles; 32 valid ability rerolls.
- 14 `ABILITY_BUDGET_EXHAUSTED` warnings in 480 cases; no validation/compile failures. These warn that the requested number of abilities could not fit the chosen budget, not that the blueprint is invalid.
- Detailed machine-readable results: `docs/RC-INTEGRATION-AUDIT-1.2.1-rc.1.json`.

## Known limitation of the current Battlefield Control package

Battlefield Control 0.1.0-dev.7 declares `relationships.requires[].compatibility.minimum: "1.2.1"`. Strict prerelease version resolution does not consider `1.2.1-rc.1` to satisfy that stable minimum. During RC testing the addon dependency requirement must be temporarily adjusted, or the addon release should wait for Creature Forge 1.2.1 stable. **The addon ZIP was not changed by this RC.**

## Still required in Foundry

1. Enable Creature Forge 1.2.1-rc.1 in a Foundry 14 / PF2e 8.4+ world and verify its editor loads without console errors.
2. Inspect all three checkbox groups, their alignment/selection/toggle/keyboard behavior, and the free-form tags.
3. Generate a creature with multiple ability libraries and focus tags; confirm skill requirements and melee/ranged ability eligibility.
4. Lock Defenses and independently reroll Defensive Affinities; create the NPC Actor to check Foundry's actual schema/flag expansion.
5. Send an ability with linked effects to chat and test click-to-selected-target and drag-to-token with Effect Forge installed.
6. When compatible addon prerelease metadata is available, test activation and registration of Battlefield Control inside Foundry.

**Status:** Release candidate packaged and automated tests passed; not a stable release and no live Foundry test was run here. GitHub download metadata points to a future release asset and will work only after that asset is published.
