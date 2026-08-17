import { MODULE_ID } from "../constants.js";
import { deepClone } from "../core/clone.js";

const BRIDGE_PREFIX = `${MODULE_ID}.affliction-forge`;
const CATEGORY_TAGS = new Set([
  "aberration", "astral", "ethereal", "monitor", "beast", "celestial", "dragon", "elemental",
  "fey", "fungus", "humanoid", "construct", "plant", "giant", "fiend", "ooze", "animal", "undead"
]);
const SUBTYPE_TAGS = new Set([
  "amphibious", "aquatic", "mindless", "incorporeal", "ghost", "swarm", "air", "earth", "fire", "metal",
  "water", "wood", "acid", "poison", "disease", "cold", "electricity", "holy", "unholy", "angel", "azata",
  "daemon", "demon", "devil", "protean", "psychopomp"
]);

function text(value, fallback = "") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function unique(values = []) {
  return [...new Set((values ?? []).map((value) => String(value ?? "").trim().toLowerCase()).filter(Boolean))];
}

function safeId(value) {
  return text(value, "library").replace(/[^a-zA-Z0-9_.:-]+/g, "-");
}

function fnv1a(input) {
  let hash = 0x811c9dc5;
  const source = String(input ?? "");
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

export function definitionFingerprint(definition) {
  try { return fnv1a(JSON.stringify(stableValue(definition ?? {}))); }
  catch { return fnv1a(String(definition ?? "")); }
}

export function afflictionForgeBridgeLibraryId(libraryId) {
  return `${BRIDGE_PREFIX}.${safeId(libraryId)}`;
}

function contentIdForDescriptor(descriptor) {
  return `${BRIDGE_PREFIX}.template.${fnv1a(descriptor?.uuid ?? descriptor?.definitionId ?? descriptor?.name ?? "unknown")}`;
}

function levelSelection(level) {
  const value = Number(level);
  if (!Number.isFinite(value)) return {};
  return {
    minimumLevel: Math.max(-1, Math.floor(value) - 2),
    maximumLevel: Math.min(24, Math.ceil(value) + 4)
  };
}

function semanticSelection(definition = {}, descriptor = {}) {
  const raw = unique([
    ...(definition.traits ?? descriptor.traits ?? []),
    ...(definition.themes ?? descriptor.themes ?? [])
  ]);
  const categories = raw.filter((tag) => CATEGORY_TAGS.has(tag));
  const subtypes = raw.filter((tag) => SUBTYPE_TAGS.has(tag) && !["poison", "disease"].includes(tag));
  const selection = { ...levelSelection(definition.level ?? descriptor.level) };

  // Prefer explicit semantic category/theme matches. Combining category and subtype
  // filters would make many published templates unnecessarily strict, so only use
  // the more informative category set when one exists.
  if (categories.length) selection.categories = categories;
  else if (subtypes.length) selection.anySubtypes = subtypes;
  else {
    const type = text(definition.afflictionType ?? descriptor.afflictionType, "disease").toLowerCase();
    if (type === "poison") selection.anySubtypes = ["poison"];
    else if (type === "disease") selection.anySubtypes = ["disease"];
    else if (type === "curse") selection.categories = ["fiend", "undead", "fey", "aberration", "monitor"];
  }
  return selection;
}

function deliveryProfileFor(definition = {}) {
  const type = text(definition.afflictionType, "disease").toLowerCase();
  if (definition.delivery?.injuryPoison === true) {
    return {
      hostOrder: ["attack"], trigger: "on-damage", application: "automatic",
      preferredDamageTypes: ["piercing", "slashing"], injuryPoison: true, charges: 1, fallback: "manual"
    };
  }
  if (type === "poison") {
    return {
      hostOrder: ["attack", "ability"], trigger: "on-damage", application: "automatic",
      preferredDamageTypes: ["piercing", "slashing"],
      preferredAttackNames: ["bite", "jaws", "fang", "sting", "stinger", "claw", "maw"],
      preferredAbilityTags: ["poison", "venom", "strike"], fallback: "manual"
    };
  }
  if (type === "disease") {
    return {
      hostOrder: ["ability", "attack"], trigger: "on-hit", application: "automatic",
      preferredDamageTypes: ["piercing", "slashing"],
      preferredAttackNames: ["bite", "jaws", "claw", "maw", "spore"],
      preferredAbilityTags: ["disease", "spore", "fungus", "strike"], fallback: "manual"
    };
  }
  if (type === "curse") {
    return {
      hostOrder: ["ability", "attack"], trigger: "on-use", application: "prompt",
      preferredAbilityTags: ["curse", "fiend", "unholy", "mental", "control", "fear"], fallback: "manual"
    };
  }
  return { hostOrder: ["ability", "attack"], trigger: "on-use", application: "prompt", fallback: "manual" };
}

function bridgedEntry({ descriptor, definition, library, bridgeLibraryId }) {
  const id = contentIdForDescriptor(descriptor);
  const tags = unique([
    definition.afflictionType,
    ...(definition.traits ?? descriptor.traits ?? []),
    ...(definition.themes ?? descriptor.themes ?? []),
    "affliction-forge-library"
  ]);
  return {
    id,
    slug: text(definition.id ?? descriptor.definitionId ?? descriptor.id, id),
    name: text(definition.name ?? descriptor.name, descriptor.name ?? id),
    description: text(definition.description),
    tags,
    themes: unique(definition.themes ?? descriptor.themes ?? []),
    selection: semanticSelection(definition, descriptor),
    baseWeight: 55,
    powerCost: 3,
    preserveDefinitionScale: true,
    definition: deepClone(definition),
    deliveryProfile: deliveryProfileFor(definition),
    source: {
      sourceKind: "affliction-forge-library",
      moduleId: library.moduleId || "pf2e-affliction-forge",
      libraryId: bridgeLibraryId,
      afflictionForgeLibraryId: library.id,
      afflictionForgeProviderId: library.providerId ?? null,
      afflictionForgeProviderLabel: library.providerLabel ?? null,
      templateUuid: descriptor.uuid,
      originalDefinitionId: descriptor.definitionId ?? definition.id ?? null,
      definitionVersion: Number(descriptor.definitionVersion ?? 1),
      definitionFingerprint: definitionFingerprint(definition),
      readOnly: Boolean(descriptor.readOnly),
      loadedFromAfflictionForge: true,
      detached: false
    }
  };
}

export class AfflictionForgeLibraryBridge {
  constructor({ registry, integrations }) {
    this.registry = registry;
    this.integrations = integrations;
    this.libraryMap = new Map();
    this.prepared = new Set();
    this.lastRefresh = null;
    this.lastWarnings = [];
  }

  get api() { return this.integrations?.afflictionApi ?? null; }
  get available() {
    const api = this.api;
    return Boolean(api?.libraries?.list && api?.libraries?.templates && api?.templates?.read);
  }

  isBridgeLibraryId(libraryId) {
    return this.libraryMap.has(String(libraryId ?? "")) || String(libraryId ?? "").startsWith(`${BRIDGE_PREFIX}.`);
  }

  async refreshLibraries({ force = false } = {}) {
    if (!this.available) return { available: false, libraries: [], warnings: [] };
    if (this.lastRefresh && !force) return { available: true, libraries: this.listLibraries(), warnings: deepClone(this.lastWarnings) };

    const libraries = this.api.libraries.list({ includeImplicit: true }) ?? [];
    const nextIds = new Set();
    this.lastWarnings = [];

    for (const library of libraries) {
      if (!library?.id) continue;
      const bridgeId = afflictionForgeBridgeLibraryId(library.id);
      nextIds.add(bridgeId);
      this.libraryMap.set(bridgeId, deepClone(library));
      const existing = this.registry.getAfflictionLibrary(bridgeId);
      const wasPrepared = this.prepared.has(bridgeId) && !force;
      if (existing && wasPrepared) continue;
      try {
        this.registry.registerAfflictionLibrary({
          id: bridgeId,
          moduleId: library.moduleId || "pf2e-affliction-forge",
          version: library.version || this.api?.moduleVersion || this.api?.version || "0.0.0",
          label: library.label || library.id,
          description: library.description || "",
          defaultEnabled: library.kind !== "compendium" && library.enabled !== false && library.available !== false,
          tags: ["affliction-forge", `affliction-forge:${library.kind ?? "library"}`],
          source: {
            sourceKind: "affliction-forge-library",
            afflictionForgeLibraryId: library.id,
            providerId: library.providerId ?? null,
            providerLabel: library.providerLabel ?? null,
            libraryKind: library.kind ?? null,
            available: library.available !== false,
            enabled: library.enabled !== false,
            loaded: false
          },
          content: { afflictions: [], effects: [] }
        }, { replace: Boolean(existing || force) });
      } catch (error) {
        this.lastWarnings.push({ libraryId: library.id, message: error?.message ?? String(error) });
      }
    }

    // Remove bridge libraries that disappeared from Affliction Forge.
    for (const bridgeId of [...this.libraryMap.keys()]) {
      if (nextIds.has(bridgeId)) continue;
      this.libraryMap.delete(bridgeId);
      this.prepared.delete(bridgeId);
      this.registry.unregisterAfflictionLibrary(bridgeId);
    }
    this.lastRefresh = Date.now();
    return { available: true, libraries: this.listLibraries(), warnings: deepClone(this.lastWarnings) };
  }

  listLibraries() {
    return [...this.libraryMap.entries()].map(([bridgeId, library]) => ({
      bridgeId,
      prepared: this.prepared.has(bridgeId),
      ...deepClone(library)
    }));
  }

  async prepareLibrary(bridgeId, { force = false } = {}) {
    await this.refreshLibraries({ force: false });
    const id = String(bridgeId ?? "");
    const library = this.libraryMap.get(id);
    if (!library) return { prepared: false, libraryId: id, count: 0, warnings: [{ message: `Unknown Affliction Forge library: ${id}` }] };
    if (this.prepared.has(id) && !force) {
      return { prepared: true, libraryId: id, count: this.registry.getAfflictionLibrary(id)?.afflictionCount ?? 0, warnings: [] };
    }

    const warnings = [];
    const descriptors = await this.api.libraries.templates({ includeDisabled: true, libraryIds: [library.id] });
    const afflictions = [];
    for (const descriptor of descriptors ?? []) {
      try {
        const definition = await this.api.templates.read(descriptor.uuid);
        if (!definition) continue;
        afflictions.push(bridgedEntry({ descriptor, definition, library, bridgeLibraryId: id }));
      } catch (error) {
        warnings.push({ templateUuid: descriptor?.uuid ?? null, message: error?.message ?? String(error) });
      }
    }

    this.registry.registerAfflictionLibrary({
      id,
      moduleId: library.moduleId || "pf2e-affliction-forge",
      version: library.version || this.api?.moduleVersion || this.api?.version || "0.0.0",
      label: library.label || library.id,
      description: library.description || "",
      defaultEnabled: library.kind !== "compendium" && library.enabled !== false && library.available !== false,
      tags: ["affliction-forge", `affliction-forge:${library.kind ?? "library"}`],
      source: {
        sourceKind: "affliction-forge-library",
        afflictionForgeLibraryId: library.id,
        providerId: library.providerId ?? null,
        providerLabel: library.providerLabel ?? null,
        libraryKind: library.kind ?? null,
        available: library.available !== false,
        enabled: library.enabled !== false,
        loaded: true,
        templateCount: afflictions.length
      },
      content: { afflictions, effects: [] }
    }, { replace: true });
    this.prepared.add(id);
    return { prepared: true, libraryId: id, count: afflictions.length, warnings };
  }

  async ensure(sources = {}, { force = false } = {}) {
    const refresh = await this.refreshLibraries({ force });
    if (!refresh.available) return { available: false, prepared: [], warnings: refresh.warnings ?? [] };
    const selected = this.registry.resolveAfflictionLibrarySelection(sources?.afflictions ?? []);
    const bridgeIds = selected.filter((id) => this.libraryMap.has(id));
    const prepared = [];
    const warnings = [...(refresh.warnings ?? [])];
    for (const bridgeId of bridgeIds) {
      try {
        const result = await this.prepareLibrary(bridgeId, { force });
        prepared.push(result);
        warnings.push(...(result.warnings ?? []).map((warning) => ({ libraryId: bridgeId, ...warning })));
      } catch (error) {
        warnings.push({ libraryId: bridgeId, message: error?.message ?? String(error) });
      }
    }
    return { available: true, prepared, warnings };
  }

  isPrepared(sources = {}) {
    if (!this.available) return true;
    const selected = this.registry.resolveAfflictionLibrarySelection(sources?.afflictions ?? []);
    return selected.filter((id) => this.libraryMap.has(id)).every((id) => this.prepared.has(id));
  }

  clearCache() {
    for (const id of this.prepared) {
      const library = this.libraryMap.get(id);
      if (!library) continue;
      this.registry.registerAfflictionLibrary({
        id,
        moduleId: library.moduleId || "pf2e-affliction-forge",
        version: library.version || "0.0.0",
        label: library.label || library.id,
        description: library.description || "",
        defaultEnabled: library.kind !== "compendium" && library.enabled !== false && library.available !== false,
        tags: ["affliction-forge"],
        source: { sourceKind: "affliction-forge-library", afflictionForgeLibraryId: library.id, loaded: false },
        content: { afflictions: [], effects: [] }
      }, { replace: true });
    }
    this.prepared.clear();
    this.lastRefresh = null;
    return true;
  }

  status() {
    return {
      available: this.available,
      libraries: this.listLibraries(),
      prepared: [...this.prepared],
      warnings: deepClone(this.lastWarnings)
    };
  }
}
