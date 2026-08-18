import test from "node:test";
import assert from "node:assert/strict";
import { abilityAreaTemplateInline } from "../scripts/ability-presentation.js";
import { CORE_ABILITIES } from "../scripts/core/core-abilities.js";

function withLanguage(lang, fn) {
  const previous = globalThis.game;
  globalThis.game = { i18n: { lang, localize: (key) => key } };
  try { return fn(); } finally { globalThis.game = previous; }
}

test("area mechanics render PF2e inline template links with localized labels", () => {
  withLanguage("de", () => {
    assert.equal(
      abilityAreaTemplateInline({ mechanics: { area: { shape: "cone", distanceFeet: 15 } } }),
      "@Template[type:cone|distance:15]{4,5 m Kegel}"
    );
    assert.equal(
      abilityAreaTemplateInline({ mechanics: { area: { shape: "line", distanceFeet: 60, widthFeet: 10 } } }),
      "@Template[type:line|distance:60|width:10]{18 m Linie}"
    );
  });
});

test("unsupported or incomplete area mechanics do not emit broken inline templates", () => {
  assert.equal(abilityAreaTemplateInline({ mechanics: { area: { shape: "sphere", distanceFeet: 20 } } }), "");
  assert.equal(abilityAreaTemplateInline({ mechanics: { area: { shape: "burst", distanceFeet: 0 } } }), "");
  assert.equal(abilityAreaTemplateInline({}), "");
});

test("all static core abilities tagged as area define explicit template geometry", () => {
  const missing = CORE_ABILITIES
    .filter((ability) => ability.tags.includes("area") && !ability.signature?.kind)
    .filter((ability) => !ability.mechanics?.area?.shape || !(Number(ability.mechanics.area.distanceFeet) > 0))
    .map((ability) => ability.slug);
  assert.deepEqual(missing, []);
});
