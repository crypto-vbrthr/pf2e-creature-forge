import test from "node:test";
import assert from "node:assert/strict";
import { localize, format, currentLanguage, hasEmbeddedTranslation } from "../scripts/i18n.js";

test("embedded Creature Forge catalog keeps German UI localized when Foundry returns raw keys", () => {
  const previous = globalThis.game;
  globalThis.game = {
    i18n: { lang: "de", localize: (key) => key, format: (key) => key }
  };
  try {
    assert.equal(currentLanguage(), "de");
    assert.equal(localize("PF2E_CREATURE_FORGE.Action.Generate", "Generate"), "Generieren");
    assert.equal(localize("PF2E_CREATURE_FORGE.Ability.DefensiveBrace.Name", "defensive-brace"), "Defensive Haltung");
    assert.equal(localize("PF2E_CREATURE_FORGE.Effect.Guarded.Description", ""), "Die Kreatur erhält für die Dauer des Effekts einen Umstandsbonus von +1 auf ihre RK.");
    assert.equal(localize("PF2E_CREATURE_FORGE.Runtime.Timing.Trigger", "trigger"), "Bei Auslöser");
    assert.equal(localize("PF2E_CREATURE_FORGE.Trait.fear", "fear"), "Furcht");
    assert.equal(format("PF2E_CREATURE_FORGE.Runtime.Applied", { name: "Gedeckt", count: 1 }, "fallback"), "Gedeckt wurde auf 1 Ziel(e) angewendet.");
    assert.equal(hasEmbeddedTranslation("PF2E_CREATURE_FORGE.Open", "de"), true);
  } finally {
    globalThis.game = previous;
  }
});

test("embedded catalog follows English Foundry language", () => {
  const previous = globalThis.game;
  globalThis.game = { i18n: { lang: "en", localize: (key) => key } };
  try {
    assert.equal(localize("PF2E_CREATURE_FORGE.Action.Generate", "Generate"), "Generate");
    assert.equal(localize("PF2E_CREATURE_FORGE.Ability.DefensiveBrace.Name", "defensive-brace"), "Defensive Brace");
  } finally {
    globalThis.game = previous;
  }
});
