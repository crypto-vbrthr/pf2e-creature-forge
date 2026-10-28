import test from "node:test";
import assert from "node:assert/strict";
import { buildAbilityDescription } from "../scripts/core/compiler.js";
import { CreatureAbilityInteractionRuntime } from "../scripts/runtime/ability-interaction-runtime.js";
import { initializeEffectRuntimeUi } from "../scripts/runtime/effect-runtime.js";

function fixture() {
  const ability = {
    id: "ability-1", name: "Pinning Strike", description: "A Strike with a speed penalty.",
    applications: [{ type: "effect", ref: "sample.effect.pin", target: "target", timing: "on-hit" }]
  };
  const resource = {
    id: "sample.effect.pin", name: "Pinned", definition: {
      id: "sample.effect.pin", name: "Pinned", components: [{ type: "movement", movementType: "land", value: -10 }]
    }
  };
  const actor = {
    uuid: "Actor.predator", id: "predator", getRollData: () => ({}),
    flags: { "pf2e-creature-forge": { blueprint: {
      abilities: [ability], resources: { effects: [resource] }
    }, runtime: { effects: { [resource.id]: { primaryUuid: "Item.draggable" } } } } },
    items: [{ name: "Pinning Strike", flags: { "pf2e-creature-forge": { abilityId: ability.id } } }]
  };
  return { ability, resource, actor };
}

test("shared ability chats show a draggable named effect button when effect application is available", async () => {
  const { actor } = fixture();
  const previous = { game: globalThis.game, TextEditor: globalThis.TextEditor, ChatMessage: globalThis.ChatMessage };
  const created = [];
  globalThis.game = { user: { isGM: true, id: "gm" }, i18n: { localize: (key) => key } };
  globalThis.TextEditor = { enrichHTML: async (html) => html };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async (data) => { created.push(data); return data; } };
  try {
    const runtime = new CreatureAbilityInteractionRuntime({ canApplyEffects: () => true });
    await runtime.sendAbilityToChat({ actor, abilityId: "ability-1" });
    assert.equal(created.length, 1);
    const html = created[0].content;
    assert.match(html, /class="pf2e-creature-forge-apply-effect pf2e-creature-forge-drag-effect" draggable="true"/);
    assert.match(html, /data-cf-effect-item-uuid="Item\.draggable"/);
    assert.match(html, /data-cf-effect-ref="sample\.effect\.pin"/);
    assert.match(html, /<span>Pinned<\/span>/);
    assert.doesNotMatch(html, /class="pf2e-creature-forge-share-ability"/);
    assert.doesNotMatch(html, /@UUID\[Item\.draggable\]/);
  } finally {
    Object.assign(globalThis, previous);
  }
});

test("chat effect chips are not offered without an Effect Forge apply integration", () => {
  const { ability, resource } = fixture();
  const html = buildAbilityDescription(ability, new Map([[resource.id, resource]]), {
    runtimeLinks: { [resource.id]: { primaryUuid: "Item.draggable" } },
    actorUuid: "Actor.predator", runtimeAvailable: false, renderForChat: true
  });
  assert.doesNotMatch(html, /pf2e-creature-forge-drag-effect/);
  assert.match(html, /@UUID\[Item\.draggable\]/);
});

test("chat button drag contains native item UUID plus validated explicit token-target metadata", async () => {
  const previous = { document: globalThis.document, Hooks: globalThis.Hooks, game: globalThis.game, fromUuid: globalThis.fromUuid, ui: globalThis.ui };
  const listeners = {}, hooks = {}, applied = [], messages = [];
  const { actor } = fixture();
  const tokenA = { actor: { id: "A" }, bounds: { contains: (x) => x >= 0 && x < 100 } };
  const tokenB = { actor: { id: "B" }, bounds: { contains: (x) => x >= 200 && x < 300 } };
  globalThis.document = { addEventListener: (name, fn) => { listeners[name] = fn; } };
  globalThis.Hooks = { on: (name, fn) => { hooks[name] = fn; } };
  globalThis.game = { user: { isGM: true }, i18n: { localize: (key) => key, format: (key) => key } };
  globalThis.fromUuid = async () => actor;
  globalThis.ui = { notifications: { info: (value) => messages.push(value), warn: (value) => messages.push(value), error: (value) => messages.push(value) } };
  try {
    initializeEffectRuntimeUi({
      apply: async ({ actor: targetSource, targets }) => {
        applied.push({ targetSource, targets });
        return { targets, resource: { name: "Pinned", definition: { name: "Pinned" } } };
      },
      cleanupActorResources: async () => []
    });
    assert.equal(typeof listeners.dragstart, "function");
    assert.equal(typeof hooks.dropCanvasData, "function");
    const attrs = {
      cfActorUuid: "Actor.predator", cfAbilityId: "ability-1",
      cfEffectRef: "sample.effect.pin", cfApplicationIndex: "0", cfEffectItemUuid: "Item.draggable"
    };
    let serialized;
    const button = { dataset: attrs };
    listeners.dragstart({ target: { closest: () => button }, dataTransfer: {
      setData: (type, value) => { assert.equal(type, "text/plain"); serialized = value; }
    } });
    const payload = JSON.parse(serialized);
    assert.equal(payload.type, "Item");
    assert.equal(payload.uuid, "Item.draggable");
    assert.equal(payload.creatureForgeEffect.actorUuid, "Actor.predator");
    const returnValue = hooks.dropCanvasData({ tokens: { placeables: [tokenA, tokenB] } }, { ...payload, x: 250, y: 20 });
    assert.equal(returnValue, false);
    for (let i = 0; i < 5 && applied.length === 0; i++) await new Promise((resolve) => setImmediate(resolve));
    assert.equal(applied.length, 1);
    assert.equal(applied[0].targetSource, actor);
    assert.deepEqual(applied[0].targets, [tokenB]);
    assert.ok(messages.length);
    // Tampered/stale chat payload must not apply an unrelated effect.
    hooks.dropCanvasData({ tokens: { placeables: [tokenB] } }, {
      ...payload, creatureForgeEffect: { ...payload.creatureForgeEffect, effectRef: "unrelated" }, x: 250, y: 20
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(applied.length, 1);
  } finally {
    Object.assign(globalThis, previous);
  }
});
