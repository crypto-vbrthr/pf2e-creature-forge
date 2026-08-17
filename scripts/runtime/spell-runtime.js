import { deepClone } from "../core/clone.js";

function moduleFlags(item) { return item?.flags?.["pf2e-creature-forge"] ?? item?._source?.flags?.["pf2e-creature-forge"] ?? {}; }
function randomId() { return globalThis.foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2, 18); }

async function sourceFromUuid(uuid) {
  if (!uuid) return null;
  const document = await globalThis.fromUuid?.(uuid);
  if (!document) return null;
  return document.toObject ? document.toObject() : deepClone(document._source ?? document);
}

function slotKey(rank) { return `slot${Math.max(0, Math.min(10, Number(rank) || 0))}`; }

function initialSlots(style, spells, idsBySpell) {
  const slots = {};
  if (style === "innate") return slots;

  if (style === "prepared") {
    const grouped = new Map();
    for (const spell of spells) {
      const rank = spell.cantrip ? 0 : Number(spell.rank ?? spell.baseRank ?? 1);
      const list = grouped.get(rank) ?? [];
      list.push(spell);
      grouped.set(rank, list);
    }
    for (const [rank, list] of grouped) {
      slots[slotKey(rank)] = {
        max: list.length,
        prepared: list
          .map((spell) => idsBySpell.get(spell.id) ?? null)
          .filter(Boolean)
          .map((id) => ({ id }))
      };
    }
    return slots;
  }

  // Spontaneous NPC entries use a shared number of casts per rank. Keep the
  // repertoire as embedded spells and expose a compact rank pool for casting.
  const grouped = new Map();
  for (const spell of spells.filter((candidate) => !candidate.cantrip)) {
    const rank = Number(spell.rank ?? spell.baseRank ?? 1);
    grouped.set(rank, (grouped.get(rank) ?? 0) + 1);
  }
  for (const [rank, knownCount] of grouped) {
    const max = Math.max(1, Math.min(4, knownCount + 1));
    slots[slotKey(rank)] = { value: max, max };
  }
  return slots;
}

export class CreatureSpellRuntime {
  async materialize(actor, blueprint = null) {
    const sourceBlueprint = blueprint ?? actor?.flags?.["pf2e-creature-forge"]?.blueprint;
    const entries = sourceBlueprint?.combat?.spellcasting ?? [];
    if (!actor || !entries.length) return { entries: [], spells: [], diagnostics: [] };
    const diagnostics = [];
    const createdSpells = [];
    const entryItems = [...(actor.items ?? [])].filter((item) => item.type === "spellcastingEntry");

    for (const entry of entries) {
      const entryItem = entryItems.find((item) => moduleFlags(item).spellcastingId === entry.id);
      if (!entryItem) {
        diagnostics.push({ level: "warning", code: "SPELLCASTING_ENTRY_NOT_FOUND", spellcastingId: entry.id });
        continue;
      }
      const idsBySpell = new Map(entry.spells.map((spell) => [spell.id, randomId()]));
      const sources = [];
      for (const spell of entry.spells) {
        const source = await sourceFromUuid(spell.sourceUuid);
        if (!source) {
          diagnostics.push({ level: "warning", code: "SPELL_SOURCE_NOT_FOUND", sourceUuid: spell.sourceUuid, name: spell.name });
          continue;
        }
        source._id = idsBySpell.get(spell.id);
        source.type = "spell";
        source.system ??= {};
        source.system.location = {
          ...(source.system.location ?? {}),
          value: entryItem.id,
          ...(!spell.cantrip && Number(spell.rank) > Number(spell.baseRank)
            ? { heightenedLevel: Number(spell.rank) }
            : {})
        };
        if (entry.style === "innate" && !spell.cantrip) {
          const uses = Math.max(1, Number(spell.uses ?? 1));
          source.system.location.uses = { value: uses, max: uses };
        } else {
          delete source.system.location.uses;
        }
        source.flags ??= {};
        source.flags["pf2e-creature-forge"] = { spellcastingId: entry.id, spellId: spell.id, sourceUuid: spell.sourceUuid };
        delete source.folder;
        sources.push(source);
      }
      let made = [];
      if (sources.length) made = await actor.createEmbeddedDocuments("Item", sources, { keepId: true });
      createdSpells.push(...made);
      if (["prepared", "spontaneous"].includes(entry.style)) {
        await entryItem.update({ "system.slots": initialSlots(entry.style, entry.spells, idsBySpell) });
      }
    }
    return { entries: entryItems, spells: createdSpells, diagnostics };
  }

  async cleanup(actor) {
    const spells = [...(actor?.items ?? [])].filter((item) => item.type === "spell" && moduleFlags(item).spellcastingId);
    if (spells.length) await actor.deleteEmbeddedDocuments("Item", spells.map((item) => item.id));
    return spells.length;
  }
}
