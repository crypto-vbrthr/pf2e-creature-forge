import test from "node:test";
import assert from "node:assert/strict";
import { initializeLootRuntimeUi } from "../scripts/runtime/loot-runtime-ui.js";

test("deferred loot UI registers PF2E 8.4 ApplicationV1 actor-sheet hooks as well as v14 generic hooks", () => {
  const previousHooks = globalThis.Hooks;
  const registered = [];
  globalThis.Hooks = { on: (name) => registered.push(name) };
  try {
    initializeLootRuntimeUi({ createDeferredLootActor: async () => null });
    for (const name of [
      "getApplicationV1HeaderButtons",
      "getApplicationHeaderButtons",
      "getActorSheetHeaderButtons",
      "renderApplicationV1",
      "renderApplication",
      "renderActorSheet"
    ]) {
      assert.ok(registered.includes(name), `missing legacy PF2e/Foundry hook: ${name}`);
    }
    assert.ok(registered.includes("getHeaderControlsApplicationV2"));
    assert.ok(registered.includes("renderApplicationV2"));
  } finally {
    globalThis.Hooks = previousHooks;
  }
});
