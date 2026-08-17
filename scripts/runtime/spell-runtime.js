import { deepClone } from "../core/clone.js";

const MODULE_ID = "pf2e-creature-forge";
let fallbackIdCounter = 0;

function moduleFlags(item) { return item?.flags?.[MODULE_ID] ?? item?._source?.flags?.[MODULE_ID] ?? {}; }

function randomId() {
  const foundryId = globalThis.foundry?.utils?.randomID?.();
  if (foundryId) return foundryId;
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid.replaceAll("-", "").slice(0, 16);
  fallbackIdCounter += 1;
  return `cfspell${Date.now().toString(36)}${fallbackIdCounter.toString(36)}`.slice(-16);
}

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
      const id = idsBySpell.get(spell.id);
      if (!id) continue;
      const rank = spell.cantrip ? 0 : Number(spell.rank ?? spell.baseRank ?? 1);
      const list = grouped.get(rank) ?? [];
      list.push(id);
      grouped.set(rank, list);
    }
    for (const [rank, ids] of grouped) {
      slots[slotKey(rank)] = {
        max: ids.length,
        prepared: ids.map((id) => ({ id }))
      };
    }
    return slots;
  }

  // Spontaneous NPC entries use a shared number of casts per rank. Only
  // successfully materialized spells contribute to the repertoire/slot pool.
  const grouped = new Map();
  for (const spell of spells.filter((candidate) => !candidate.cantrip && idsBySpell.has(candidate.id))) {
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
    const sourceBlueprint = blueprint ?? actor?.flags?.[MODULE_ID]?.blueprint;
    if (!actor) return { entries: [], spells: [], diagnostics: [], cleanup: { removed: 0 } };

    // Materialization is a synchronization operation. Clear only Creature Forge
    // generated spell Items first so repeated refreshes remain idempotent while
    // preserving spells a GM added manually.
    const cleanupRemoved = await this.cleanup(actor);
    const cleanup = { removed: cleanupRemoved };
    const entries = sourceBlueprint?.combat?.spellcasting ?? [];
    if (!entries.length) return { entries: [], spells: [], diagnostics: [], cleanup };

    const diagnostics = [];
    const createdSpells = [];
    const entryItems = [...(actor.items ?? [])].filter((item) => item.type === "spellcastingEntry");

    for (const entry of entries) {
      const entryItem = entryItems.find((item) => moduleFlags(item).spellcastingId === entry.id);
      if (!entryItem) {
        diagnostics.push({ level: "warning", code: "SPELLCASTING_ENTRY_NOT_FOUND", spellcastingId: entry.id });
        continue;
      }

      const idsBySpell = new Map();
      const sources = [];
      for (const spell of entry.spells ?? []) {
        try {
          const source = await sourceFromUuid(spell.sourceUuid);
          if (!source) {
            diagnostics.push({ level: "warning", code: "SPELL_SOURCE_NOT_FOUND", sourceUuid: spell.sourceUuid, name: spell.name });
            continue;
          }
          const generatedId = randomId();
          idsBySpell.set(spell.id, generatedId);
          source._id = generatedId;
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
          source.flags[MODULE_ID] = { spellcastingId: entry.id, spellId: spell.id, sourceUuid: spell.sourceUuid, runtimeSpell: true };
          delete source.folder;
          sources.push(source);
        } catch (error) {
          diagnostics.push({
            level: "warning",
            code: "SPELL_SOURCE_RESOLUTION_FAILED",
            sourceUuid: spell.sourceUuid,
            name: spell.name,
            message: error?.message ?? String(error)
          });
        }
      }

      let made = [];
      if (sources.length) {
        try {
          made = await actor.createEmbeddedDocuments("Item", sources, { keepId: true });
          createdSpells.push(...made);
        } catch (error) {
          diagnostics.push({
            level: "error",
            code: "SPELL_MATERIALIZATION_FAILED",
            spellcastingId: entry.id,
            message: error?.message ?? String(error)
          });
          continue;
        }
      }

      // If Foundry declined/replaced one of the requested IDs, only keep IDs that
      // actually exist after creation. This avoids prepared slots pointing at ghost
      // spell documents after a partial materialization.
      const madeIds = new Set(made.map((item) => item?.id ?? item?._id).filter(Boolean));
      for (const [spellId, id] of [...idsBySpell]) if (!madeIds.has(id)) idsBySpell.delete(spellId);

      if (["prepared", "spontaneous"].includes(entry.style)) {
        try {
          await entryItem.update({ "system.slots": initialSlots(entry.style, entry.spells ?? [], idsBySpell) });
        } catch (error) {
          diagnostics.push({
            level: "warning",
            code: "SPELL_SLOTS_UPDATE_FAILED",
            spellcastingId: entry.id,
            message: error?.message ?? String(error)
          });
        }
      }
    }
    return { entries: entryItems, spells: createdSpells, diagnostics, cleanup };
  }

  async cleanup(actor) {
    const spells = [...(actor?.items ?? [])].filter((item) => item.type === "spell" && moduleFlags(item).spellcastingId);
    if (spells.length && typeof actor?.deleteEmbeddedDocuments === "function") {
      await actor.deleteEmbeddedDocuments("Item", spells.map((item) => item.id));
    }
    return spells.length;
  }
}
