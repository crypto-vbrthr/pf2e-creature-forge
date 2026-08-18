# PF2E Creature Forge 0.7.3 – Ability & Signature Runtime Review

## Scope

This review targeted the interaction boundary introduced by the 0.7.x content expansion: ordinary abilities, generated signature powers, Effect Forge resources, native PF2E inline area templates, Affliction delivery, optional Auras, spellcasting, and loot materialization.

The goal was not to add another signature family. The goal was to make the current families safe to rerender, refresh, validate, and materialize when several Forge subsystems are active on the same Actor.

## Findings and fixes

### Effect refresh vs. hosted Affliction delivery

A generated ability can be both Effect-backed and the carrier for an Affliction. Initial Actor creation was correct because Effect descriptions were written before Affliction delivery markup. An independent Effect refresh, however, rebuilt the ability description from the Blueprint and could erase the already-verified Affliction host block.

0.7.3 makes the marked Affliction host block preservable and has the Effect runtime merge it back into the rebuilt ability description. This keeps subsystem refreshes independent without requiring the Effect runtime to recreate Affliction references.

### Area target semantics

The ability power estimator already recognized `target: "area"`, but the runtime target resolver did not. An external ability using that target mode would therefore fall through to singular-target behavior and apply its Effect only to the first selected target.

`area` now explicitly resolves all selected Foundry targets.

### Executable mechanic validation

The Blueprint validator now rejects ability mechanics that would produce a description/runtime contract Creature Forge cannot execute safely:

- unsupported area shapes;
- non-positive area distance or line width;
- unsupported save types or invalid save DCs;
- unknown Effect target modes.

The supported area geometry remains `burst`, `cone`, `emanation`, and `line`.

### Consolidated runtime status

Several runtimes deliberately isolate per-resource failures. This is useful because one broken Effect or missing Spell should not destroy an otherwise valid Actor. Before 0.7.3, however, the top-level Actor runtime status could still report `ready` because the subsystem returned a result object containing its warning internally.

Runtime-status schema v2 now distinguishes:

- `ready`: subsystem completed without diagnostics;
- `degraded`: subsystem completed, but one or more resources emitted warnings/errors handled internally;
- `failed`: the subsystem step itself threw and could not complete;
- `skipped`: materialization was disabled by the caller.

Nested Effect, Aura, Affliction, Spell, and Loot diagnostics are promoted into the consolidated status. `strictRuntime` continues to reject only error-level diagnostics, not ordinary degradation warnings.

### Release/documentation drift

The review also found two non-runtime regressions:

- `module.json` still pointed its download URL to the 0.7.0 GitHub release despite later module versions;
- README still documented Embedded Creature Editor contract v11 even though the actual/API contract is v12.

Both are corrected in 0.7.3.

## Compatibility

No Generation Request, Blueprint, or Content schema bump is required. The data represented in those schemas did not change.

- Request schema: v7
- Blueprint schema: v10
- Content schema: v10
- Embedded Creature Editor contract: v12
- Runtime-status flag schema: v2
- Module/API: 0.7.3

## Deliberate boundaries retained

0.7.3 does not add automatic PF2E save-result adjudication for signature area damage. Dragon Breath, Phoenix Rebirth, and similar generated powers retain their current explicit/manual save workflow. Hydra head destruction/regrowth and Phoenix resurrection remain GM-adjudicated mechanics rather than hidden combat automation.

## Automated review evidence

The release test suite passes **169/169 tests**. In addition, a one-off audit generated **1,008** core combinations across seven representative levels, all core roles, and all core creature categories with zero invalid Blueprints. A second interaction audit executed **63** ability/special-feature/attack rerolls across Dragon, Troll, Vampire, Hydra, Phoenix, and Elemental signature concepts at levels 5, 12, and 20, again with zero invalid Blueprints.
