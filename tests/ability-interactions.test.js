import test from "node:test";
import assert from "node:assert/strict";
import { abilityInteractionInline } from "../scripts/ability-presentation.js";
import { materializeAbility } from "../scripts/core/ability-engine.js";
import { buildAbilityDescription } from "../scripts/core/compiler.js";
import { CreatureAbilityInteractionRuntime } from "../scripts/runtime/ability-interaction-runtime.js";

test("ability interactions render native PF2e inline checks, actions, damage, and GM rolls", () => {
  assert.equal(
    abilityInteractionInline({ kind: "check", statistic: "athletics", defense: "reflex", label: "Drag Down" }),
    "@Check[athletics|defense:reflex]{Drag Down}"
  );
  assert.equal(abilityInteractionInline({ kind: "action", slug: "trip" }), "[[/act trip]]");
  assert.equal(abilityInteractionInline({ kind: "damage", formula: "2d6+4", damageType: "slashing", label: "Damage" }), "@Damage[(2d6+4)[slashing]]{Damage}");
  assert.equal(abilityInteractionInline({ kind: "roll", formula: "1d4", gmOnly: true, flavor: "Recharge", label: "1d4 rounds" }), "[[/gmr 1d4 #Recharge]]{1d4 rounds}");
});

test("ability materialization resolves ranked creature DCs and persists interaction metadata", () => {
  const ability = materializeAbility({
    id: "test.fear",
    name: "Fear",
    interactions: [{ kind: "check", statistic: "will", dcRank: "high", mode: "chat" }]
  }, 0, { level: 10 });
  assert.equal(ability.interactions[0].dc, 29);
  assert.deepEqual(ability.interactions[0].dcSource, { mode: "creature-rank", rank: "high", level: 10 });
  assert.equal(ability.shareToChat, true);
});

test("ability descriptions expose inline controls, chat requests, and a share button after actor runtime initialization", () => {
  const ability = {
    id: "ability-1",
    name: "Predator Move",
    description: "Do a predatory thing.",
    shareToChat: true,
    interactions: [
      { kind: "action", slug: "trip", mode: "inline" },
      { kind: "check", statistic: "will", dc: 24, mode: "chat", label: "Will save", requestLabel: "Request Will save" }
    ]
  };
  const html = buildAbilityDescription(ability, new Map(), {
    actorUuid: "Actor.abc",
    interactionRuntimeAvailable: true
  });
  assert.match(html, /\[\[\/act trip\]\]/);
  assert.match(html, /pf2e-creature-forge-chat-interaction/);
  assert.match(html, /Request Will save/);
  assert.match(html, /pf2e-creature-forge-share-ability/);
});

test("chat rendering converts chat-mode interactions back into native PF2e inline links and omits share controls", () => {
  const ability = {
    id: "ability-1",
    name: "Territorial Challenge",
    description: "Roar.",
    interactions: [{ kind: "check", statistic: "will", dc: 24, mode: "chat", label: "Will save" }]
  };
  const html = buildAbilityDescription(ability, new Map(), { renderForChat: true });
  assert.match(html, /@Check\[will\|dc:24\]\{Will save\}/);
  assert.doesNotMatch(html, /pf2e-creature-forge-chat-interaction/);
  assert.doesNotMatch(html, /pf2e-creature-forge-share-ability/);
});

test("ability interaction runtime can send a compact enriched request to chat", async () => {
  const created = [];
  globalThis.game = { user: { id: "gm", isGM: true }, i18n: { localize: (key) => key } };
  globalThis.TextEditor = { enrichHTML: async (content) => `<enriched>${content}</enriched>` };
  globalThis.ChatMessage = {
    getSpeaker: ({ actor }) => ({ actor: actor.id }),
    create: async (data) => { created.push(data); return data; }
  };
  const actor = {
    id: "A1",
    uuid: "Actor.A1",
    flags: { "pf2e-creature-forge": { blueprint: { abilities: [{ id: "ability-1", name: "Roar", interactions: [{ kind: "check", statistic: "will", dc: 24, mode: "chat", label: "Will save" }] }] } } },
    items: [{ id: "I1", name: "Roar", flags: { "pf2e-creature-forge": { abilityId: "ability-1" } } }],
    getRollData: () => ({})
  };
  const runtime = new CreatureAbilityInteractionRuntime();
  await runtime.sendInteractionToChat({ actor, abilityId: "ability-1", interactionIndex: 0 });
  assert.equal(created.length, 1);
  assert.match(created[0].content, /<enriched>/);
  assert.match(created[0].content, /@Check\[will\|dc:24\]/);
});
