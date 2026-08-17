import test from "node:test";
import assert from "node:assert/strict";
import { CreatureSpellRuntime } from "../scripts/runtime/spell-runtime.js";

function spellSource(name, rank, traits = []) {
  return {
    name,
    type: "spell",
    img: `${name}.webp`,
    system: {
      level: { value: rank },
      location: { value: null },
      traits: { value: traits, traditions: ["arcane"], rarity: "common" }
    },
    flags: {}
  };
}

function makeActor(entryId = "entry-1") {
  const entry = {
    id: entryId,
    type: "spellcastingEntry",
    flags: { "pf2e-creature-forge": { spellcastingId: "spellcasting-1" } },
    system: { slots: {} },
    updates: [],
    async update(data) { this.updates.push(data); if (data["system.slots"]) this.system.slots = data["system.slots"]; }
  };
  const actor = {
    items: [entry],
    created: [],
    deleted: [],
    async createEmbeddedDocuments(_type, sources) {
      const made = sources.map((source) => ({ id: source._id, type: source.type, ...source }));
      this.created.push(...made);
      this.items.push(...made);
      return made;
    },
    async deleteEmbeddedDocuments(_type, ids) { this.deleted.push(...ids); this.items = this.items.filter((item) => !ids.includes(item.id)); }
  };
  return { actor, entry };
}

test("prepared spell runtime materializes spells, heightens ranked spells, and creates prepared slot references including cantrips", async () => {
  const previousFromUuid = globalThis.fromUuid;
  const previousFoundry = globalThis.foundry;
  let seq = 0;
  globalThis.foundry = { utils: { randomID: () => `generated-${++seq}` } };
  globalThis.fromUuid = async (uuid) => ({
    toObject: () => uuid.endsWith("cantrip") ? spellSource("Cantrip", 0, ["cantrip"]) : spellSource("Ranked", 2)
  });
  const { actor, entry } = makeActor();
  const blueprint = {
    combat: {
      spellcasting: [{
        id: "spellcasting-1", style: "prepared", highestRank: 4,
        spells: [
          { id: "spell-1", sourceUuid: "Compendium.test.Item.ranked", baseRank: 2, rank: 4, cantrip: false },
          { id: "spell-2", sourceUuid: "Compendium.test.Item.cantrip", baseRank: 0, rank: 4, cantrip: true }
        ]
      }]
    }
  };
  try {
    const runtime = new CreatureSpellRuntime();
    const result = await runtime.materialize(actor, blueprint);
    assert.equal(result.spells.length, 2);
    const ranked = actor.created.find((item) => item.name === "Ranked");
    const cantrip = actor.created.find((item) => item.name === "Cantrip");
    assert.equal(ranked.system.location.value, entry.id);
    assert.equal(ranked.system.location.heightenedLevel, 4);
    assert.equal(cantrip.system.location.value, entry.id);
    assert.ok(!("autoHeightenLevel" in cantrip.system.location));
    assert.ok(!("heightenedLevel" in cantrip.system.location));
    assert.deepEqual(entry.system.slots.slot4.prepared, [{ id: ranked._id }]);
    assert.equal(entry.system.slots.slot4.max, 1);
    assert.deepEqual(entry.system.slots.slot0.prepared, [{ id: cantrip._id }]);
    assert.equal(entry.system.slots.slot0.max, 1);
  } finally {
    globalThis.fromUuid = previousFromUuid;
    globalThis.foundry = previousFoundry;
  }
});

test("innate spell runtime gives ranked spells daily uses and leaves cantrips at-will", async () => {
  const previousFromUuid = globalThis.fromUuid;
  const previousFoundry = globalThis.foundry;
  let seq = 0;
  globalThis.foundry = { utils: { randomID: () => `innate-${++seq}` } };
  globalThis.fromUuid = async (uuid) => ({
    toObject: () => uuid.endsWith("cantrip") ? spellSource("Innate Cantrip", 0, ["cantrip"]) : spellSource("Innate Spell", 3)
  });
  const { actor } = makeActor();
  const blueprint = { combat: { spellcasting: [{ id: "spellcasting-1", style: "innate", highestRank: 4, spells: [
    { id: "spell-1", sourceUuid: "Compendium.test.Item.innate", baseRank: 3, rank: 3, cantrip: false, uses: 2 },
    { id: "spell-2", sourceUuid: "Compendium.test.Item.cantrip", baseRank: 0, rank: 4, cantrip: true, uses: null }
  ] }] } };
  try {
    await new CreatureSpellRuntime().materialize(actor, blueprint);
    const ranked = actor.created.find((item) => item.name === "Innate Spell");
    const cantrip = actor.created.find((item) => item.name === "Innate Cantrip");
    assert.deepEqual(ranked.system.location.uses, { value: 2, max: 2 });
    assert.ok(!("uses" in cantrip.system.location));
  } finally {
    globalThis.fromUuid = previousFromUuid;
    globalThis.foundry = previousFoundry;
  }
});
