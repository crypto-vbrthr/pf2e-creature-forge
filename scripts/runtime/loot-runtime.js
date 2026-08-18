import { MODULE_ID } from "../constants.js";
import { deepClone } from "../core/clone.js";
import { localize } from "../i18n.js";

const FLAG = `flags.${MODULE_ID}.loot`;

function managedFlag(channel, blueprint) {
  return { managed: true, channel, seed: blueprint?.metadata?.seed ?? "", schemaVersion: 1 };
}

const TREASURE_CATEGORIES = new Set(["art-object", "coin", "gem", "material", "credstick"]);
const TREASURE_SIZES = new Set(["tiny", "med", "lg", "huge", "grg"]);

function integer(value, fallback = 0, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

function coinsFromCopper(totalCopper) {
  let remaining = Math.max(0, Math.round(Number(totalCopper ?? 0)));
  const pp = Math.floor(remaining / 1000);
  remaining -= pp * 1000;
  const gp = Math.floor(remaining / 100);
  remaining -= gp * 100;
  const sp = Math.floor(remaining / 10);
  const cp = remaining - sp * 10;
  const result = {};
  if (pp) result.pp = pp;
  if (gp) result.gp = gp;
  if (sp) result.sp = sp;
  if (cp || !Object.keys(result).length) result.cp = cp;
  return result;
}

function normalizedCoins(coins = {}) {
  const denominations = ["pp", "gp", "sp", "cp"];
  const alreadyValid = denominations.every((denomination) => {
    const value = coins?.[denomination];
    return value === undefined || (Number.isInteger(Number(value)) && Number(value) >= 0);
  });
  if (alreadyValid) {
    const result = {};
    for (const denomination of denominations) {
      const value = Number(coins?.[denomination] ?? 0);
      if (value || (denomination === "cp" && !Object.keys(result).length)) result[denomination] = value;
    }
    return result;
  }

  const copper = Number(coins?.pp ?? 0) * 1000
    + Number(coins?.gp ?? 0) * 100
    + Number(coins?.sp ?? 0) * 10
    + Number(coins?.cp ?? 0);
  return coinsFromCopper(copper);
}

function gpPrice(valueGp) {
  return coinsFromCopper(Number(valueGp ?? 0) * 100);
}

/**
 * PF2e 8.4's TreasureSystemData is strict: legacy stackGroup/usage fields are
 * no longer schema members and coin denominations in PriceField must be
 * non-negative integers. Loot Forge 0.3.x can still hand us its older
 * generated-treasure shape, so normalize that boundary before persistence.
 */
function normalizeTreasureSource(source) {
  if (source?.type !== "treasure") return source;
  const system = source.system && typeof source.system === "object" ? source.system : (source.system = {});
  const legacyStackGroup = system.stackGroup;

  if (!TREASURE_CATEGORIES.has(system.category)) {
    system.category = legacyStackGroup === "coins" ? "coin" : legacyStackGroup === "gems" ? "gem" : null;
  }
  delete system.stackGroup;
  delete system.usage;
  delete system.apex;
  delete system.subitems;
  delete system.schema;

  system.baseItem = typeof system.baseItem === "string" && system.baseItem ? system.baseItem : null;
  // A copied compendium containerId points at the source document, not this new Loot Actor.
  system.containerId = null;
  system.bulk = { value: (() => {
    const value = Number(system.bulk?.value ?? 0);
    return value === 0.1 || (Number.isInteger(value) && value >= 0 && value <= 1000) ? value : 0;
  })() };
  system.equipped = { carryType: "worn" };
  system.hardness = integer(system.hardness, 0);
  system.hp = {
    value: integer(system.hp?.value, 0),
    max: integer(system.hp?.max, 0)
  };
  if (system.hp.value > system.hp.max) system.hp.value = system.hp.max;
  system.identification = {
    status: system.identification?.status === "unidentified" ? "unidentified" : "identified",
    unidentified: system.identification?.unidentified ?? null
  };
  system.level = { value: integer(system.level?.value, 0, { max: 30 }) };
  system.material = {
    type: system.material?.type ?? null,
    grade: system.material?.grade ?? null
  };
  system.price = {
    value: normalizedCoins(system.price?.value ?? {}),
    per: integer(system.price?.per, 1, { min: 1 })
  };
  system.quantity = integer(system.quantity, 1);
  system.size = TREASURE_SIZES.has(system.size) ? system.size : "med";
  system.traits = {
    value: Array.isArray(system.traits?.value) ? system.traits.value.filter((trait) => trait === "precious") : [],
    rarity: ["common", "uncommon", "rare", "unique"].includes(system.traits?.rarity) ? system.traits.rarity : "common",
    otherTags: Array.isArray(system.traits?.otherTags) ? system.traits.otherTags.filter((tag) => typeof tag === "string") : []
  };
  return source;
}

function prepareItem(item, channel, blueprint) {
  const source = deepClone(item);
  delete source._id;
  delete source.folder;
  delete source.sort;
  delete source.ownership;
  delete source._stats;
  source.flags ??= {};
  source.flags[MODULE_ID] ??= {};
  source.flags[MODULE_ID].loot = managedFlag(channel, blueprint);
  return normalizeTreasureSource(source);
}

function salvageItem(entry, blueprint) {
  // Build from the current PF2e 8.4 treasure boundary rather than relying on
  // legacy generated-treasure defaults. The shared normalizer fills every
  // required physical treasure field and canonicalizes fractional GP prices.
  return normalizeTreasureSource({
    name: localize(entry?.nameKey, entry?.fallbackName ?? "Usable creature remains"),
    type: "treasure",
    img: "icons/commodities/bones/bones-stack-grey.webp",
    system: {
      description: { value: `<p>${localize("PF2E_CREATURE_FORGE.Loot.Salvage.Description", "Usable remains recovered from this creature.")}</p>` },
      price: { value: gpPrice(entry?.valueGp) },
      quantity: Math.max(1, Number(entry?.quantity ?? 1)),
      bulk: { value: 0 },
      category: null
    },
    flags: { [MODULE_ID]: { loot: managedFlag("salvage", blueprint), salvage: deepClone(entry) } }
  });
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

function sanitizedLootPayload(loot, blueprint) {
  return {
    coins: deepClone(loot?.coins ?? {}),
    pf2eItems: (loot?.pf2eItems ?? []).map((item) => prepareItem(item, "hoard", blueprint)),
    generatedItems: (loot?.generatedItems ?? []).map((item) => prepareItem(item, "hoard", blueprint))
  };
}

async function createNativeLootActor(actorName) {
  if (!globalThis.Actor?.create) throw new Error("Foundry Actor API is unavailable.");
  return globalThis.Actor.create({
    name: actorName,
    type: "loot",
    img: "icons/containers/chest/chest-reinforced-steel-red.webp"
  }, { renderSheet: false });
}

async function addCoinsNative(actor, coins = {}) {
  if (typeof actor?.update !== "function") return;
  const current = actor.system?.currency ?? {};
  const next = {
    cp: Number(current.cp?.value ?? current.cp ?? 0) + Number(coins.cp ?? 0),
    sp: Number(current.sp?.value ?? current.sp ?? 0) + Number(coins.sp ?? 0),
    gp: Number(current.gp?.value ?? current.gp ?? 0) + Number(coins.gp ?? 0),
    pp: Number(current.pp?.value ?? current.pp ?? 0) + Number(coins.pp ?? 0)
  };
  await actor.update({
    "system.currency.cp": next.cp,
    "system.currency.sp": next.sp,
    "system.currency.gp": next.gp,
    "system.currency.pp": next.pp
  }, { render: false });
}

async function deleteActorQuietly(actor) {
  try { await actor?.delete?.(); } catch (error) { console.warn(`${MODULE_ID} | Failed to remove incomplete deferred Loot Actor.`, error); }
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

  async #persistMaterialization(sourceActor, createdActor, channels) {
    if (!sourceActor) return true;
    const record = materializationRecord(createdActor, channels);
    const lootFlag = deepClone(sourceActor?.flags?.[MODULE_ID]?.loot ?? {});
    lootFlag.materialized ??= {};
    for (const channel of channels) lootFlag.materialized[channel] = deepClone(record);

    try {
      if (typeof sourceActor.setFlag === "function") {
        await sourceActor.setFlag(MODULE_ID, "loot", lootFlag);
      } else if (typeof sourceActor.update === "function") {
        await sourceActor.update({ [FLAG]: lootFlag }, { render: false });
      }
      return true;
    } catch (error) {
      // The Loot Actor already exists. Do not turn a bookkeeping failure into a
      // false "creation failed" report or encourage the GM to create duplicates.
      console.warn(`${MODULE_ID} | Deferred loot was created, but source-actor provenance could not be persisted.`, error);
      return false;
    }
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
    const rawHoard = useHoard ? blueprint?.loot?.channels?.hoard?.result?.loot : null;
    const hoard = sanitizedLootPayload(rawHoard, blueprint);
    const salvageEntries = useSalvage ? blueprint?.loot?.channels?.salvage?.result?.entries ?? [] : [];
    const salvage = salvageEntries.map((entry) => salvageItem(entry, blueprint));
    const combined = {
      coins: hoard.coins,
      pf2eItems: [...hoard.pf2eItems, ...salvage],
      generatedItems: hoard.generatedItems
    };
    const suffixKey = useSalvage && useHoard
      ? "PF2E_CREATURE_FORGE.Loot.DeferredLoot"
      : useSalvage
        ? "PF2E_CREATURE_FORGE.Loot.SalvageLoot"
        : "PF2E_CREATURE_FORGE.Loot.HoardLoot";
    const suffixFallback = useSalvage && useHoard ? "Loot" : useSalvage ? "Salvage" : "Hoard";
    const actorName = name ?? `${blueprint.identity?.name ?? "Creature"} · ${localize(suffixKey, suffixFallback)}`;

    let createdActor = null;
    try {
      // Materialize through Foundry/PF2e directly. Loot Forge remains the
      // generator, but its 0.3.x writer still mutates some physical-item fields
      // using a pre-PF2e-8.4 schema (notably treasure stackGroup and legacy
      // identification flags). Keeping the persistence boundary here lets us
      // guarantee the exact current PF2e source shape.
      if (globalThis.Actor?.create) {
        createdActor = await createNativeLootActor(actorName);
        await addCoinsNative(createdActor, combined.coins);
        const items = [...combined.pf2eItems, ...combined.generatedItems];
        if (items.length && typeof createdActor.createEmbeddedDocuments === "function") {
          await createdActor.createEmbeddedDocuments("Item", items, { render: false });
        }
      } else if (lootApi?.createLootActorWithLoot) {
        // Compatibility fallback for harnesses/hosts without the Foundry Actor
        // constructor. Real Foundry v14 worlds always take the native branch.
        createdActor = await lootApi.createLootActorWithLoot(actorName, combined);
      } else {
        throw new Error("Foundry Actor API is unavailable.");
      }
    } catch (error) {
      if (createdActor) await deleteActorQuietly(createdActor);
      const detail = error?.message ? ` ${error.message}` : "";
      throw new Error(`Deferred loot materialization failed.${detail}`, { cause: error });
    }

    if (!createdActor) throw new Error("Deferred loot materialization returned no Actor.");

    const channels = [useSalvage ? "salvage" : null, useHoard ? "hoard" : null].filter(Boolean);
    await this.#persistMaterialization(sourceActor, createdActor, channels);
    return createdActor;
  }
}
