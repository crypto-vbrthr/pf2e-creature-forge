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
      summary: deepClone(blueprint?.loot?.summary ?? {})
    };
    if (typeof actor.update === "function") await actor.update({ [FLAG]: deferred }, { render: false });
    return { created, deferred };
  }

  async createDeferredLootActor(actorOrBlueprint, { name = null, includeSalvage = true, includeHoard = true } = {}) {
    const blueprint = actorOrBlueprint?.identity ? actorOrBlueprint : actorOrBlueprint?.flags?.[MODULE_ID]?.blueprint;
    if (!blueprint) throw new Error("Creature blueprint is required to create deferred loot.");
    const lootApi = this.integrations?.lootApi;
    const hoard = includeHoard ? blueprint?.loot?.channels?.hoard?.result?.loot : null;
    const salvageEntries = includeSalvage ? blueprint?.loot?.channels?.salvage?.result?.entries ?? [] : [];
    const salvage = salvageEntries.map((entry) => salvageItem(entry, blueprint));
    const combined = {
      coins: deepClone(hoard?.coins ?? {}),
      pf2eItems: [...deepClone(hoard?.pf2eItems ?? []), ...salvage],
      generatedItems: deepClone(hoard?.generatedItems ?? [])
    };
    const actorName = name ?? `${blueprint.identity?.name ?? "Creature"} · ${localize("PF2E_CREATURE_FORGE.Loot.DeferredLoot", "Loot")}`;
    if (lootApi?.createLootActorWithLoot) return lootApi.createLootActorWithLoot(actorName, combined);
    if (!globalThis.Actor?.create) throw new Error("Foundry Actor API is unavailable.");
    const actor = await globalThis.Actor.create({ name: actorName, type: "loot", img: "icons/containers/chest/chest-reinforced-steel-red.webp" }, { renderSheet: false });
    if (combined.pf2eItems.length || combined.generatedItems.length) await actor.createEmbeddedDocuments("Item", [...combined.pf2eItems, ...combined.generatedItems]);
    return actor;
  }
}
