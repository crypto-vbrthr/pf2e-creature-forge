# PF2E Creature Forge 1.2.2-rc.2: Draft request preservation

## Root cause

The selected focus-tag chip state and the current editor request diverged from the blueprint's older `metadata.requestSnapshot`. The old scoped-reroll path used the latter exclusively and then assigned the old snapshot back to the editor. RC.1 fixed stale checkbox highlighting, but exposed this pre-existing state reset. Reproduction against 1.2.2-rc.1: check `fire` and `reaction`, reroll abilities, both tags disappear.

## Fix

- The editor session passes the current draft request to scoped and full rerolls (`reroll` and `rerollAsync`).
- `CreatureGenerator.reroll` honors an explicitly provided request in every scope, updating the rerolled blueprint's request snapshot. Existing no-override calls are unchanged.
- The direct Loot Forge refresh helpers accept an optional current request, and the editor supplies it for the three loot refresh actions.
- CSS selection state continues to come from `input:checked` (rc.1).

## Validation

- Regression test reproduces reset in rc.1 and validates retention in rc.2 across focused ability, statistics, attack, and spellcasting rerolls, plus deselection and legacy API calls.
- `npm test`: 231/231 passed.
- `npm run check`: JavaScript syntax passed.
- Full Foundry 14 UI test has not been run. Browser navigation in this test environment is restricted, so do not treat the Node tests as a Foundry validation.

## Compatibility

Foundry 14 / PF2e >=8.4.0. Request v8, Blueprint v12, Content v11, Embedded Editor v14, runtime-status v2 unchanged. Add-ons requiring Creature Forge 1.2.1 stay compatible in principle, subject to Foundry prerelease dependency resolution.
