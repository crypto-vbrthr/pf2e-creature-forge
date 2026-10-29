# Creature Forge 1.2.1 — Stable release notes

Promoted from `1.2.1-rc.2` with no feature or generation logic changes. Version/manifest/doc metadata only.

## Included

- Source checkbox controls (All / None), explicitly empty source selection, scroll retention.
- Focus tags as weighted checkboxes alongside optional free-form tags.
- Skill and attack prerequisites for selected abilities, localized `critical-failure` effect timing.
- Chat effect buttons supporting click to selected targets and dragging onto tokens.

## Spellcasting

A forced spellcasting request still needs at least one enabled and accessible spell compendium matching the spell-selection rules. The apparent RC regression was resolved by configuring spell sources and did not require a code change.

## Compatibility

Foundry VTT 14; PF2e system minimum 8.4.0. Public contracts are unchanged (Request v8, Blueprint v12, Content v11, Embedded Editor v14, runtime-status v2).

## Verification

Run `npm test` and `npm run check` against the exact release archive. User confirmed the RC UI worked in Foundry after correcting source configuration. No in-FVTT automated integration claims are made.
