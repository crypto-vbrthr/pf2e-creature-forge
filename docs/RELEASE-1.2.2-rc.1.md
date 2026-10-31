# Creature Forge 1.2.2-rc.1: Focus-tag chip state hotfix

Builds on the previously reviewed 1.2.1 stable release and only adjusts the visual state of focus-tag checkboxes.

## Bug and correction

The focus chips were rendered with both a persistent `is-selected` CSS class and an interactive native checkbox. Unchecking updated the checkbox and underlying request, but the class stayed on the label until the next full rerender, leaving the chip falsely highlighted.

The label's background/border now uses only the actual checked state (`:has(input:checked)`); the stale render-time class is removed. Clicking the chip and keyboard activation retain normal native checkbox behavior. User-defined tags and all selection weights are unaffected.

## Validation

- `npm test`: 228/228 passed.
- `npm run check`: all JavaScript syntax checks passed.
- Browser smoke (Chromium): compared the exact 1.2.1 stylesheet against 1.2.2-rc.1. After toggling off, the 1.2.1 chip remained highlighted, while the patched chip immediately lost its highlight. Re-selecting worked normally.
- Live Foundry 14 test remains pending.

## Compatibility

Foundry 14 / PF2e >= 8.4.0. Request v8, Blueprint v12, Content v11, Embedded Editor v14, runtime-status v2 remain unchanged. Add-ons compatible with 1.2.1 remain compatible with this patch candidate.
