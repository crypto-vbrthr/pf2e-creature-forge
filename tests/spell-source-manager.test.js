import test from "node:test";
import assert from "node:assert/strict";
import { SpellSourceManager } from "../scripts/core/spell-source-manager.js";

function makePack(entries) {
  return {
    collection: "pf2e.spells-srd",
    documentName: "Item",
    metadata: { id: "pf2e.spells-srd", label: "Spells", type: "Item", packageName: "pf2e", packageType: "system" },
    async getIndex() { return entries; }
  };
}

test("spell source manager discovers spell compendiums and excludes rituals/focus spells", async () => {
  const previousGame = globalThis.game;
  const entries = [
    {
      _id: "fire",
      type: "spell",
      name: "Flammenstoß",
      img: "fire.webp",
      system: {
        slug: "flame-blast",
        level: { value: 3 },
        traits: { value: ["fire", "manipulate"], traditions: ["arcane", "primal"], rarity: "common" },
        ritual: null,
        area: { type: "cone", value: 30 },
        defense: { save: { statistic: "reflex" } },
        damage: { 0: { type: "fire" } }
      }
    },
    {
      _id: "teleport",
      type: "spell",
      name: "Versetzen",
      system: {
        slug: "translated-name-does-not-matter",
        level: { value: 4 },
        traits: { value: ["teleportation"], traditions: ["arcane", "occult"], rarity: "common" },
        ritual: null,
        area: null,
        defense: null,
        damage: {}
      }
    },
    {
      _id: "focus",
      type: "spell",
      name: "Focus",
      system: { slug: "focus", level: { value: 2 }, traits: { value: ["focus"], traditions: ["divine"], rarity: "common" }, ritual: null }
    },
    {
      _id: "ritual",
      type: "spell",
      name: "Ritual",
      system: { slug: "ritual", level: { value: 2 }, traits: { value: [], traditions: [], rarity: "uncommon" }, ritual: { primary: { check: "Arcana" } } }
    },
    { _id: "item", type: "equipment", name: "Not a spell", system: {} }
  ];
  const pack = makePack(entries);
  const packs = [pack];
  packs.get = (id) => id === pack.collection ? pack : null;
  globalThis.game = { packs };

  try {
    const manager = new SpellSourceManager();
    assert.deepEqual(manager.getDefaultSourceIds(), ["pf2e.spells-srd"]);
    const result = await manager.ensure({ spells: [] });
    assert.equal(result.scanned[0].spellCount, 2);
    const spells = manager.listSpells([]);
    assert.equal(spells.length, 2);
    assert.ok(spells.find((spell) => spell.id.endsWith(":fire"))?.themes.includes("fire"));
    assert.ok(spells.find((spell) => spell.id.endsWith(":teleport"))?.themes.includes("movement"), "canonical teleportation trait should derive movement even with a localized name");
    assert.ok(spells.every((spell) => !spell.focus && !spell.ritual));
    assert.ok(spells.every((spell) => spell.sourceUuid.startsWith("Compendium.pf2e.spells-srd.Item.")));
  } finally {
    globalThis.game = previousGame;
  }
});
