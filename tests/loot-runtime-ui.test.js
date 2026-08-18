import test from "node:test";
import assert from "node:assert/strict";
import { initializeLootRuntimeUi } from "../scripts/runtime/loot-runtime-ui.js";

test("deferred loot UI uses header controls without mutating the PF2E actor-sheet render tree", () => {
  const previousHooks = globalThis.Hooks;
  const registered = [];
  globalThis.Hooks = { on: (name) => registered.push(name) };
  try {
    initializeLootRuntimeUi({ createDeferredLootActor: async () => null });

    for (const name of [
      "getApplicationV1HeaderButtons",
      "getApplicationHeaderButtons",
      "getActorSheetHeaderButtons",
      "getHeaderControlsApplicationV2"
    ]) {
      assert.ok(registered.includes(name), `missing actor-sheet header hook: ${name}`);
    }

    for (const name of [
      "renderApplicationV2",
      "renderApplicationV1",
      "renderApplication",
      "renderActorSheet"
    ]) {
      assert.ok(!registered.includes(name), `deferred-loot UI must not mutate actor-sheet render DOM via ${name}`);
    }
  } finally {
    globalThis.Hooks = previousHooks;
  }
});

test("Loot header control opens a separate DialogV2 instead of rendering into the NPC sheet", () => {
  const previousHooks = globalThis.Hooks;
  const previousGame = globalThis.game;
  const previousFoundry = globalThis.foundry;
  const handlers = new Map();
  const dialogs = [];

  class FakeDialogV2 {
    constructor(options) {
      this.options = options;
      dialogs.push(this);
    }
    render(options) {
      this.renderOptions = options;
      return this;
    }
  }

  globalThis.Hooks = { on: (name, callback) => handlers.set(name, callback) };
  globalThis.game = {
    user: { isGM: true },
    actors: { get: () => null },
    i18n: { lang: "de", localize: (key) => key }
  };
  globalThis.foundry = { applications: { api: { DialogV2: FakeDialogV2 } } };

  try {
    initializeLootRuntimeUi({ createDeferredLootActor: async () => null });
    const actor = {
      id: "npc-1",
      documentName: "Actor",
      type: "npc",
      flags: {
        "pf2e-creature-forge": {
          blueprint: {
            loot: {
              channels: {
                hoard: {
                  result: {
                    loot: { coins: { gp: 10 }, pf2eItems: [], generatedItems: [], totalValueGp: 10 }
                  }
                }
              }
            }
          }
        }
      }
    };
    const application = { actor };
    const buttons = [];
    handlers.get("getActorSheetHeaderButtons")(application, buttons);
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0].label, "Beute");

    buttons[0].onclick();
    assert.equal(dialogs.length, 1);
    assert.equal(dialogs[0].options.id, "pf2e-creature-forge-deferred-loot-npc-1");
    assert.match(dialogs[0].options.content, /cf-deferred-loot-dialog-content/);
    assert.equal(dialogs[0].renderOptions.force, true);
  } finally {
    globalThis.Hooks = previousHooks;
    globalThis.game = previousGame;
    globalThis.foundry = previousFoundry;
  }
});
