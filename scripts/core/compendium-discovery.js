import { MODULE_ID, MODULE_VERSION } from "../constants.js";
import { deepClone } from "./clone.js";

function documentName(pack) {
  return pack?.documentName ?? pack?.metadata?.type ?? pack?.metadata?.documentName ?? "";
}

function packId(pack) {
  return String(pack?.collection ?? pack?.metadata?.id ?? "").trim();
}

function packLabel(pack) {
  return String(pack?.metadata?.label ?? pack?.title ?? packId(pack));
}

function indexValues(index) {
  if (!index) return [];
  if (Array.isArray(index)) return index;
  if (typeof index.values === "function") return [...index.values()];
  if (typeof index[Symbol.iterator] === "function") return [...index];
  return [];
}

function traitValues(entry) {
  const direct = entry?.system?.traits?.value;
  if (Array.isArray(direct)) return direct.map(String);
  const viaFoundry = globalThis.foundry?.utils?.getProperty?.(entry, "system.traits.value");
  return Array.isArray(viaFoundry) ? viaFoundry.map(String) : [];
}

function titleCase(slug) {
  return String(slug ?? "")
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function configLabel(slug) {
  const key = globalThis.CONFIG?.PF2E?.creatureTraits?.[slug]
    ?? globalThis.CONFIG?.PF2E?.creatureTypes?.[slug]
    ?? null;
  return key || titleCase(slug);
}

function knownCreatureTypes(registry) {
  const configured = Object.keys(globalThis.CONFIG?.PF2E?.creatureTypes ?? {});
  const registered = registry.list("category").map((entry) => entry.trait ?? entry.slug).filter(Boolean);
  return new Set([...configured, ...registered]);
}

function sourceDefinition({ pack, count }) {
  return {
    sourceKind: "compendium",
    compendiumId: packId(pack),
    compendiumLabel: packLabel(pack),
    packageName: pack?.metadata?.packageName ?? pack?.metadata?.package ?? "",
    packageType: pack?.metadata?.packageType ?? "",
    occurrenceCount: Number(count ?? 0)
  };
}

export async function scanCreatureCompendium(pack, { registry } = {}) {
  if (!pack) throw new Error("Creature Forge compendium discovery requires a compendium pack.");
  const id = packId(pack);
  if (!id) throw new Error("Creature Forge cannot discover a compendium without a collection id.");
  if (String(documentName(pack)).toLowerCase() !== "actor") {
    throw new Error(`Compendium '${id}' is not an Actor compendium and cannot be used for creature category/subtype discovery.`);
  }

  const index = await pack.getIndex({ fields: ["type", "system.traits.value"] });
  const types = knownCreatureTypes(registry);
  const categoryCounts = new Map();
  const subtypeData = new Map();
  let actorCount = 0;

  for (const entry of indexValues(index)) {
    if (String(entry?.type ?? "").toLowerCase() !== "npc") continue;
    const traits = [...new Set(traitValues(entry).filter(Boolean))];
    if (!traits.length) continue;
    actorCount += 1;
    const categories = traits.filter((trait) => types.has(trait));
    for (const category of categories) categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);

    for (const trait of traits) {
      if (types.has(trait)) continue;
      const data = subtypeData.get(trait) ?? { count: 0, categories: new Set() };
      data.count += 1;
      for (const category of categories) data.categories.add(category);
      subtypeData.set(trait, data);
    }
  }

  const categories = [...categoryCounts.entries()].map(([slug, count]) => ({
    id: `${MODULE_ID}.compendium.${id}.category.${slug}`,
    slug,
    trait: slug,
    label: configLabel(slug),
    tags: ["compendium-discovery", "creature-category"],
    discovery: { count },
    source: sourceDefinition({ pack, count })
  }));

  const subtypes = [...subtypeData.entries()].map(([slug, data]) => ({
    id: `${MODULE_ID}.compendium.${id}.subtype.${slug}`,
    slug,
    trait: slug,
    label: configLabel(slug),
    tags: ["compendium-discovery", "creature-subtype"],
    supports: { categories: [...data.categories].sort() },
    discovery: { count: data.count },
    source: sourceDefinition({ pack, count: data.count })
  }));

  return {
    id,
    label: packLabel(pack),
    actorCount,
    categories: categories.sort((a, b) => a.slug.localeCompare(b.slug)),
    subtypes: subtypes.sort((a, b) => a.slug.localeCompare(b.slug))
  };
}

export class CompendiumDiscoveryManager {
  constructor({ registry }) {
    this.registry = registry;
    this.cache = new Map();
    this.registered = new Set();
    this.diagnostics = [];
  }

  listCompendiums() {
    const packs = [...(globalThis.game?.packs ?? [])];
    return packs
      .filter((pack) => String(documentName(pack)).toLowerCase() === "actor")
      .map((pack) => ({
        id: packId(pack),
        label: packLabel(pack),
        documentName: documentName(pack),
        packageName: pack?.metadata?.packageName ?? pack?.metadata?.package ?? "",
        packageType: pack?.metadata?.packageType ?? "",
        locked: Boolean(pack?.locked)
      }))
      .filter((entry) => entry.id)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  getPack(id) {
    const target = String(id ?? "");
    const collection = globalThis.game?.packs;
    if (collection?.get) return collection.get(target) ?? null;
    return [...(collection ?? [])].find((pack) => packId(pack) === target) ?? null;
  }

  async discover(compendiumId, { force = false } = {}) {
    const id = String(compendiumId ?? "").trim();
    if (!id) throw new Error("A compendium id is required for discovery.");
    if (!force && this.cache.has(id)) return deepClone(this.cache.get(id));
    const pack = this.getPack(id);
    if (!pack) throw new Error(`Compendium '${id}' is not available.`);

    try {
      const result = await scanCreatureCompendium(pack, { registry: this.registry });
      this.cache.set(id, result);
      this.#registerResult(result, { replace: force });
      return deepClone(result);
    } catch (error) {
      this.diagnostics.push({ level: "error", code: "COMPENDIUM_DISCOVERY_FAILED", compendiumId: id, message: error.message });
      throw error;
    }
  }

  async ensure(sources = {}, { force = false } = {}) {
    const categorySources = [...new Set((sources?.categories ?? []).map(String).filter(Boolean))];
    const subtypeSources = [...new Set((sources?.subtypes ?? []).map(String).filter(Boolean))];
    const ids = [...new Set([...categorySources, ...subtypeSources])];
    const results = [];
    for (const id of ids) results.push(await this.discover(id, { force }));
    return {
      categories: categorySources,
      subtypes: subtypeSources,
      discovered: results
    };
  }

  listContent(type, { selectedSources = [] } = {}) {
    const compendiumIds = [...new Set((selectedSources ?? []).map(String).filter(Boolean))];
    return this.registry.listResolved(type, { compendiumIds });
  }

  getStatus() {
    return {
      cached: [...this.cache.keys()],
      registered: [...this.registered],
      diagnostics: deepClone(this.diagnostics)
    };
  }

  isPrepared(sources = {}) {
    const ids = [...new Set([...(sources?.categories ?? []), ...(sources?.subtypes ?? [])].map(String).filter(Boolean))];
    return ids.every((id) => this.cache.has(id));
  }

  clearCache() {
    this.cache.clear();
  }

  #registerResult(result, { replace = false } = {}) {
    const bundleId = `${MODULE_ID}.compendium.${result.id}`;
    if (this.registered.has(bundleId) && !replace) return;
    if (this.registered.has(bundleId) && replace) this.registry.unregisterBundle(bundleId);
    this.registry.registerBundle({
      id: bundleId,
      moduleId: MODULE_ID,
      version: MODULE_VERSION,
      content: {
        categories: result.categories,
        subtypes: result.subtypes
      }
    }, { replace });
    this.registered.add(bundleId);
  }
}
