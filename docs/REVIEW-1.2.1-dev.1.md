# Creature Forge 1.2.1-dev.1: Clickable & Draggable Chat Effects

Shared ability messages now render any linked, applicable Effect Forge resource as a named button. A click calls the existing selected-target effect application pipeline; dragging the button onto a token uses an explicit-token apply via the `dropCanvasData` hook. If a world Item was materialized, the payload includes its UUID for normal Item drops on actor sheets. Without a world Item, a Creature Forge-specific drag payload still supports canvas token drops.

Effect eligibility is not inferred from attack or save results. Application is a GM action. Buttons only appear when the Effect Forge application API is available; without it existing effect references are still displayed. Invalid or outdated source effect references are rejected for canvas drops, and dropping off a token has no effect. Existing ability descriptions and interactions are unchanged.

Verification: 219/219 node tests and JavaScript syntax checks passed. The new tests check chat output, drag payload, the explicit canvas target, and refusal to apply an unrelated effect. Final Foundry VTT/PF2e canvas interaction requires a live test.
