import { MODULE_ID } from "../constants.js";
import { deepClone } from "../core/clone.js";
import { localize } from "../i18n.js";

const FLAG = `flags.${MODULE_ID}.loot`;

function managedFlag(channel, blueprint) {
  return { managed: true, channel, seed: blueprint?.metadata?.seed ?? "", schemaVersion: 1 };
}

function prepareItem(item, channel, blueprint) {
  const source = deepClone(item);
  delete source._id;
  source.flags ??= {};
  source.flags[MODULE_ID] ??= {};
  source.flags[MODULE_ID].loot = managedFlag(channel, blueprint);
  return source;
}

function gpPrice(valueGp) {
  return { gp: Math.max(0, Number(valueGp ?? 0)) };
}

function salvageItem(entry, blueprint) {
  return {
    name: localize(entry?.nameKey, entry?.fallbackName ?? "Usable creature remains"),
    type: "treasure",
    img: "icons/commodities/bones/bones-stack-grey.webp",
    system: {
      description: { value: `<p>${localize("PF2E_CREATURE_FORGE.Loot.Salvage.Description", "Usable remains recovered from this creature.")}</p>` },
      level: { value: Number(blueprint?.identity?.level ?? 0) },
      price: { value: gpPrice(entry?.valueGp) },
      quantity: Number(entry?.quantity ?? 1),
      size: "med",
      traits: { value: [], rarity: "common" }
    },
    flags: { [MODULE_ID]: { loot: managedFlag("salvage", blueprint), salvage: deepClone(entry) } }
  };
}

function hoardItems(blueprint) {
  const loot = blueprint?.loot?.channels?.hoard?.result?.loot ?? {};
  return [...(loot.pf2eItems ?? []), ...(loot.generatedItems ?? [])];
}

function numericCoinTotal(coins = {}) {
  // Only a display fallback. Loot Forge's totalValueGp remains authoritative when available.
  return Number(coins?.gp ?? 0) + Number(coins?.sp ?? 0) / 10 + Number(coins?.cp ?? 0) / 100 + Number(coins?.pp ?? 0) * 10;
}

export function summarizeDeferredLoot(blueprint) {
  const salvageEntries = blueprint?.loot?.channels?.salvage?.result?.entries ?? [];
  const salvageValueGp = salvageEntries.reduce((sum, entry) => sum + Number(entry?.valueGp ?? 0) * Number(entry?.quantity ?? 1), 0);
  const hoard = blueprint?.loot?.channels?.hoard?.result?.loot ?? null;
  const hoardItemList = hoard ? hoardItems(blueprint) : [];
  const hoardValueGp = Number(hoard?.totalValueGp ?? numericCoinTotal(hoard?.coins ?? {}));
  const salvageItemCount = salvageEntries.reduce((sum, entry) => sum + Math.max(1, Number(entry?.quantity ?? 1)), 0);
  const hoardItemCount = hoardItemList.length;
  return {
    salvage: {
      available: salvageEntries.length > 0,
      itemCount: salvageItemCount,
      entryCount: salvageEntries.length,
      valueGp: Math.round(salvageValueGp * 100) / 100
    },
    hoard: {
      available: Boolean(hoard && (hoardItemCount > 0 || numericCoinTotal(hoard?.coins ?? {}) > 0)),
      itemCount: hoardItemCount,
      valueGp: Math.round(hoardValueGp * 100) / 100
    },
    combined: {
      itemCount: salvageItemCount + hoardItemCount,
      valueGp: Math.round((salvageValueGp + hoardValueGp) * 100) / 100
    }
  };
}

function materializationRecord(createdActor, channels) {
  return {
    schemaVersion: 1,
    actorId: createdActor?.id ?? createdActor?._id ?? null,
    actorUuid: createdActor?.uuid ?? null,
    actorName: createdActor?.name ?? null,
    channels: [...channels],
    createdAt: Date.now()
  };
}

export class CreatureLootRuntime {
  constructor({ integrations }) { this.integrations = integrations; }

  async cleanupCarried(actor) {
    const items = Array.from(actor?.items ?? []).filter((item) => item?.flags?.[MODULE_ID]?.loot?.managed && ["equipment", "signature"].includes(item.flags[MODULE_ID].loot.channel));
    const ids = items.map((item) => item.id ?? item._id).filter(Boolean);
    if (ids.length && typeof actor?.deleteEmbeddedDocuments === "function") await actor.deleteEmbeddedDocuments("Item", ids, { render: false });
    return ids;
  }

  async materialize(actor, blueprint = actor?.flags?.[MODULE_ID]?.blueprint) {
    if (!actor || !blueprint) return { created: [], deferred: null };
    await this.cleanupCarried(actor);
    const sources = [];
    for (const channel of ["equipment", "signature"]) {
      for (const item of blueprint?.loot?.channels?.[channel]?.result?.items ?? []) sources.push(prepareItem(item, channel, blueprint));
    }
    const created = sources.length && typeof actor.createEmbeddedDocuments === "function"
      ? await actor.createEmbeddedDocuments("Item", sources, { render: false })
      : [];
    const deferred = {
      salvage: deepClone(blueprint?.loot?.channels?.salvage ?? null),
      hoard: deepClone(blueprint?.loot?.channels?.hoard ?? null),
      summary: deepClone(blueprint?.loot?.summary ?? {}),
      materialized: deepClone(actor?.flags?.[MODULE_ID]?.loot?.materialized ?? {})
    };
    if (typeof actor.update === "function") await actor.update({ [FLAG]: deferred }, { render: false });
    return { created, deferred };
  }

  async createDeferredLootActor(actorOrBlueprint, { name = null, includeSalvage = true, includeHoard = true } = {}) {
    const sourceActor = actorOrBlueprint?.flags?.[MODULE_ID]?.blueprint ? actorOrBlueprint : null;
    const blueprint = actorOrBlueprint?.identity ? actorOrBlueprint : sourceActor?.flags?.[MODULE_ID]?.blueprint;
    if (!blueprint) throw new Error("Creature blueprint is required to create deferred loot.");

    const summary = summarizeDeferredLoot(blueprint);
    const useSalvage = Boolean(includeSalvage && summary.salvage.available);
    const useHoard = Boolean(includeHoard && summary.hoard.available);
    if (!useSalvage && !useHoard) throw new Error("No deferred loot is available for the requested channels.");

    const lootApi = this.integrations?.lootApi;
    const hoard = useHoard ? blueprint?.loot?.channels?.hoard?.result?.loot : null;
    const salvageEntries = useSalvage ? blueprint?.loot?.channels?.salvage?.result?.entries ?? [] : [];
    const salvage = salvageEntries.map((entry) => salvageItem(entry, blueprint));
    const combined = {
      coins: deepClone(hoard?.coins ?? {}),
      pf2eItems: [...deepClone(hoard?.pf2eItems ?? []), ...salvage],
      generatedItems: deepClone(hoard?.generatedItems ?? [])
    };
    const suffixKey = useSalvage && useHoard
      ? "PF2E_CREATURE_FORGE.Loot.DeferredLoot"
      : useSalvage
        ? "PF2E_CREATURE_FORGE.Loot.SalvageLoot"
        : "PF2E_CREATURE_FORGE.Loot.HoardLoot";
    const suffixFallback = useSalvage && useHoard ? "Loot" : useSalvage ? "Salvage" : "Hoard";
    const actorName = name ?? `${blueprint.identity?.name ?? "Creature"} · ${localize(suffixKey, suffixFallback)}`;

    let createdActor;
    if (lootApi?.createLootActorWithLoot) {
      createdActor = await lootApi.createLootActorWithLoot(actorName, combined);
    } else {
      if (!globalThis.Actor?.create) throw new Error("Foundry Actor API is unavailable.");
      createdActor = await globalThis.Actor.create({ name: actorName, type: "loot", img: "icons/containers/chest/chest-reinforced-steel-red.webp" }, { renderSheet: false });
      if (combined.pf2eItems.length || combined.generatedItems.length) await createdActor.createEmbeddedDocuments("Item", [...combined.pf2eItems, ...combined.generatedItems]);
    }

    if (sourceActor && typeof sourceActor.update === "function") {
      const channels = [useSalvage ? "salvage" : null, useHoard ? "hoard" : null].filter(Boolean);
      const record = materializationRecord(createdActor, channels);
      const lootFlag = deepClone(sourceActor?.flags?.[MODULE_ID]?.loot ?? {});
      lootFlag.materialized ??= {};
      for (const channel of channels) lootFlag.materialized[channel] = deepClone(record);
      await sourceActor.update({ [FLAG]: lootFlag }, { render: false });
    }

    return createdActor;
  }
}
