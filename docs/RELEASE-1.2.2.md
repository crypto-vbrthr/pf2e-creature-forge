# PF2E Creature Forge 1.2.2 Stable

## Release status

Promoted the Foundry-confirmed `1.2.2-rc.2` to stable. No functional changes.

## Included fixes

- Focus-tag checkboxes select and deselect with consistent visual state.
- Current editor request is retained across section and individual ability rerolls and loot refreshes.
- Legacy API rerolls without explicit request overrides preserve their previous semantics.

## Compatibility

Foundry VTT v14, PF2e system >=8.4.0. Request v8, Blueprint v12, Content v11, Embedded Editor v14, runtime-status v2 unchanged. All existing Creature Forge add-ons targeting 1.2.1 are expected to continue working; final compatibility depends on installation.

## Release verification

- Node tests and JavaScript syntax checked on stable archive contents.
- Foundry checkbox interaction confirmed by user on rc.2.
- No release publication or upload to GitHub performed.
