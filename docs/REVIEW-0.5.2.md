# PF2E Creature Forge 0.5.2 - Core Review & Runtime Hardening

This review intentionally focuses on reliability rather than adding another generation subsystem. It covers generation boundaries, Blueprint integrity, PF2E Actor post-create runtime initialization, repeated refresh behavior, and ownership/cleanup across optional Forge integrations.

## Review matrix

The permanent automated matrix generates and validates every core role against every core creature category at levels -1, 10, and 24. During the release review an additional 1,008-combination audit covered levels -1, 1, 5, 10, 15, 20, and 24 with spellcasting disabled to isolate the core generator. No invalid Blueprint was found in that audit.

## Findings fixed

- Re-running spell materialization could accumulate Creature Forge spell documents and stale prepared-slot references. Refresh is now ownership-aware and idempotent.
- One missing or throwing spell source UUID could interrupt materialization of otherwise valid spells. Source failures are now isolated per spell and reported diagnostically.
- Prepared slots could reference requested spells that were never successfully embedded. Slot construction now uses only actual returned embedded document IDs.
- Actor-local Auras selected from external libraries were not reliably recognized as Creature Forge-owned during cleanup because ownership depended too heavily on the source content ID. Local snapshots now carry explicit provenance.
- Generated Affliction host-description cleanup relied on a nested-HTML regex shape that was not structurally idempotent. New sentinel blocks are deterministic and include migration cleanup for legacy wrappers.
- A failure in one optional post-create integration could reject `createActor()` even though the Actor already existed, leaving later runtime integrations uninitialized. Runtime subsystems are now isolated and consolidated diagnostics/status are returned and, when possible, persisted on the Actor.
- Runtime-facing Blueprint IDs and hosted-Affliction carrier references had insufficient defensive validation. Duplicate/malformed identities are rejected earlier; missing delivery carriers warn and preserve the manual fallback.

## Intentional boundaries after 0.5.2

- Automatic Effect Forge hit/save trigger execution is still deferred; existing manual application remains the supported Effect path.
- Focus-spell generation and advanced curated/signature spell packages are not part of the current spellcasting milestone.
- Spell refresh owns Creature Forge-generated embedded spell Items. It does not attempt to delete or rebuild arbitrary GM-created spellcasting entries.
- Hosted Affliction automation still delegates actual combat-trigger behavior to Affliction Forge rather than duplicating that runtime in Creature Forge.
- Loot generation/integration remains a later milestone.

These are scope boundaries, not silent fallbacks. Runtime diagnostics are intended to make partial optional-integration failures visible while preserving a usable generated Actor.
