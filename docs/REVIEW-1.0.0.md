# PF2E Creature Forge 1.0.0 – Final Release Review

## Release decision

Creature Forge 1.0.0 promotes the reviewed and successfully smoke-tested 0.9.0-rc.1 candidate to the first stable release. No gameplay, generation, runtime, schema, or optional-integration behavior was changed after the RC review.

## Stable contract baseline

- Module/API: 1.0.0
- Request schema: v8
- Blueprint schema: v11
- Content schema: v10
- Embedded Creature Editor contract: v13
- Runtime-status schema: v2
- Foundry compatibility: minimum 14, verified 14
- PF2e system minimum: 8.4.0

## Included reviewed feature surface

The stable release contains the complete reviewed Creature Forge generation stack: level/role/category-driven PF2e creature construction, skills, movement and senses, defensive affinities, attacks, special features, expanded ability libraries and signature powers, spellcasting, optional Aura/Affliction/Effect/Item/Loot Forge bridges, embedded editor/public API, reroll workflows, deferred loot handling, and the War of Immortals Mythic Creature layer with Mythic Ambusher, Brute, Caster, and Striker templates.

## Final integration status

The 0.9.0-rc.1 final integration review verified release-metadata alignment, persisted Blueprint/editor request rehydration, legacy request-snapshot normalization, capability-complete optional Forge diagnostics, and Mythic-aware validation. The candidate then passed the real Foundry/PF2e smoke test before promotion.

No schema migration or adapter change is introduced by 1.0.0. Existing 0.9.0-rc.1 data is therefore already on the stable 1.0 contract baseline.

## Verification

- Permanent automated suite: 183/183 passing tests.
- JavaScript syntax/package check: passing.
- Final RC audit: 1,008 normal generations, 504 Mythic generations, 504 compilations, and 1,728 scoped rerolls.
- Audit result: zero invalid Blueprints and zero validator warnings.
- Final package is rebuilt from the stable 1.0.0 source tree and re-tested after extraction.

## Release conclusion

No technical blocker remains for PF2E Creature Forge 1.0.0. The 1.0.0 package is the stable release baseline; future breaking public-contract changes should require an explicit migration/versioning decision rather than silent drift.
