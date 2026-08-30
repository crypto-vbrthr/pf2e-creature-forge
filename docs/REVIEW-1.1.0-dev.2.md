# Creature Forge 1.1.0-dev.2 — Core Ability Rules Text Review

## Scope

This review covers the complete shipped Core ability library after the Interactive Ability Actions foundation introduced in 1.1.0-dev.1. The goal is to replace short or flavor-only summaries with rules-complete PF2e-style descriptions and to expose actionable checks where the runtime can support them safely.

## Main changes

- Reviewed and rewrote all 50 Core ability descriptions in German and English.
- Rules text now states triggers, requirements, action timing, range/area, movement, saves, durations, conditions, forced movement, frequency, and outcomes where applicable.
- Core Pounce / Anspringen is a 1-action movement-plus-Strike activity, preserves hidden state until after the Strike, and supports alternate movement modes when the creature has the appropriate Speed.
- Core Pack Hunter / Rudeljäger now has a concrete mechanical effect: Strikes deal 1d4 additional damage while the target is within melee reach of at least two allies.
- Save-based Core abilities now materialize ranked creature DCs into structured mechanics and matching GM chat interactions.
- Movement, Step, Feint, and similar actions expose native PF2e inline action links when appropriate.
- Dynamic signature powers with saves now participate in the same interactive chat system.

## Compatibility and schemas

No new data-contract bump was required beyond the existing interactive-ability line:

- Request schema v8
- Blueprint schema v12
- Content schema v11
- Embedded Creature Editor contract v13
- Runtime-status schema v2

## Validation

- Permanent suite: 191/191 tests passing.
- Syntax check: passing.
- Core generation audit: 1,440 deterministic generations across 10 representative levels, all 8 roles, and all 18 Core categories.
- Audit result: 0 invalid Blueprints and 0 validator warnings.
- The same matrix materialized 1,076 save-bearing selected abilities and 1,559 interactive controls with 0 unresolved ranked DCs.
- Localization audit: all 50 Core ability descriptions in both German and English contain explicit structured rules text and pass the minimum completeness check.

## Release decision

The build is suitable for Foundry smoke testing as 1.1.0-dev.2. The change is primarily a rules-text and interaction-quality pass, but some Core abilities now have explicit mechanics where the earlier text did not define one, so a real-world usability pass is still appropriate before promoting the 1.1 line.
