import { CONTENT_SCHEMA_VERSION, CONTENT_TYPES, MODULE_ID } from "../constants.js";
import { deepClone } from "./clone.js";

function normalizeId(id) {
  const value = String(id ?? "").trim();
  if (!value || !value.includes(".")) throw new Error(`Content id '${value}' must be namespaced (for example module-id.entry).`);
  return value;
}

function assertType(type) {
  if (!CONTENT_TYPES.includes(type)) throw new Error(`Unsupported Creature Forge content type '${type}'.`);
  return type;
}

function normalizedAbilityLibraryContent(library = {}) {
  const content = library.content ?? {};
  return {
    abilities: [...(content.abilities ?? library.abilities ?? [])],
    effects: [...(content.effects ?? library.effects ?? [])]
  };
}

function normalizedAuraLibraryContent(library = {}) {
  const content = library.content ?? {};
  return {
    auras: [...(content.auras ?? library.auras ?? [])],
    effects: [...(content.effects ?? library.effects ?? [])]
  };
}

function normalizedAfflictionLibraryContent(library = {}) {
  const content = library.content ?? {};
  return {
    afflictions: [...(content.afflictions ?? library.afflictions ?? [])],
    effects: [...(content.effects ?? library.effects ?? [])]
  };
}

export class ContentRegistry {
  constructor() {
    this.maps = new Map(CONTENT_TYPES.map((type) => [type, new Map()]));
    this.bundleIndex = new Map();
    this.abilityLibraries = new Map();
    this.auraLibraries = new Map();
    this.afflictionLibraries = new Map();
    this.diagnostics = [];
  }

  register(type, definition, options = {}) {
    const contentType = assertType(type);
    if (!definition || typeof definition !== "object") throw new TypeError(`Content definition for ${contentType} must be an object.`);
    const id = normalizeId(definition.id);
    const map = this.maps.get(contentType);
    const existing = map.get(id);
    if (existing && !options.replace) throw new Error(`Creature Forge content '${id}' is already registered as ${contentType}.`);

    const source = {
      ...deepClone(definition.source ?? {}),
      moduleId: String(options.moduleId ?? definition.source?.moduleId ?? MODULE_ID),
      bundleId: options.bundleId ? String(options.bundleId) : (definition.source?.bundleId ?? null),
      libraryId: options.libraryId ? String(options.libraryId) : (definition.source?.libraryId ?? null),
      version: String(options.version ?? definition.source?.version ?? "0.0.0")
    };
    const normalized = {
      ...deepClone(definition),
      id,
      type: contentType,
      schemaVersion: Number(definition.schemaVersion ?? CONTENT_SCHEMA_VERSION),
      source
    };
    map.set(id, normalized);

    if (source.bundleId) {
      const bundleSet = this.bundleIndex.get(source.bundleId) ?? new Set();
      bundleSet.add(`${contentType}:${id}`);
      this.bundleIndex.set(source.bundleId, bundleSet);
    }
    return deepClone(normalized);
  }

  registerBundle(bundle, options = {}) {
    if (!bundle || typeof bundle !== "object") throw new TypeError("Content bundle must be an object.");
    const id = normalizeId(bundle.id);
    const moduleId = String(bundle.moduleId ?? options.moduleId ?? id.split(".")[0]);
    const version = String(bundle.version ?? "0.0.0");
    const content = bundle.content ?? {};
    // Dependencies are intentionally registered before the abilities that can reference them.
    const mapping = {
      categories: "category",
      subtypes: "subtype",
      nameTemplates: "nameTemplate",
      effects: "effect",
      auras: "aura",
      afflictions: "affliction",
      poisons: "poison",
      spellProfiles: "spellProfile",
      spellPackages: "spellPackage",
      lootProfiles: "lootProfile",
      abilities: "ability"
    };
    const registered = [];
    try {
      for (const [key, type] of Object.entries(mapping)) {
        for (const definition of content[key] ?? []) {
          registered.push(this.register(type, definition, {
            moduleId,
            bundleId: id,
            libraryId: options.libraryId ?? bundle.libraryId ?? null,
            version,
            replace: Boolean(options.replace)
          }));
        }
      }
      return { id, moduleId, version, registered };
    } catch (error) {
      this.unregisterBundle(id);
      this.diagnostics.push({ level: "error", code: "BUNDLE_REGISTRATION_FAILED", bundleId: id, message: error.message });
      throw error;
    }
  }

  registerAbilityLibrary(library, options = {}) {
    if (!library || typeof library !== "object") throw new TypeError("Ability library must be an object.");
    const id = normalizeId(library.id);
    if (this.abilityLibraries.has(id) && !options.replace) throw new Error(`Creature Forge ability library '${id}' is already registered.`);
    if (this.abilityLibraries.has(id) && options.replace) this.unregisterAbilityLibrary(id);

    const moduleId = String(library.moduleId ?? options.moduleId ?? id.split(".")[0]);
    const version = String(library.version ?? "0.0.0");
    const content = normalizedAbilityLibraryContent(library);
    const bundle = this.registerBundle({
      id,
      moduleId,
      version,
      content
    }, { libraryId: id, replace: Boolean(options.replace) });

    const normalized = {
      id,
      moduleId,
      version,
      label: library.label ?? id,
      labelKey: library.labelKey ?? null,
      description: library.description ?? "",
      descriptionKey: library.descriptionKey ?? null,
      defaultEnabled: library.defaultEnabled !== false,
      tags: [...new Set(library.tags ?? [])],
      abilityCount: bundle.registered.filter((entry) => entry.type === "ability").length,
      effectCount: bundle.registered.filter((entry) => entry.type === "effect").length,
      source: deepClone(library.source ?? {})
    };
    this.abilityLibraries.set(id, normalized);
    return deepClone(normalized);
  }



  registerAuraLibrary(library, options = {}) {
    if (!library || typeof library !== "object") throw new TypeError("Aura library must be an object.");
    const id = normalizeId(library.id);
    if (this.auraLibraries.has(id) && !options.replace) throw new Error(`Creature Forge aura library '${id}' is already registered.`);
    if (this.auraLibraries.has(id) && options.replace) this.unregisterAuraLibrary(id);
    const moduleId = String(library.moduleId ?? options.moduleId ?? id.split(".")[0]);
    const version = String(library.version ?? "0.0.0");
    const content = normalizedAuraLibraryContent(library);
    const bundle = this.registerBundle({ id, moduleId, version, content }, { libraryId: id, replace: Boolean(options.replace) });
    const normalized = {
      id, moduleId, version,
      label: library.label ?? id,
      labelKey: library.labelKey ?? null,
      description: library.description ?? "",
      descriptionKey: library.descriptionKey ?? null,
      defaultEnabled: library.defaultEnabled !== false,
      tags: [...new Set(library.tags ?? [])],
      auraCount: bundle.registered.filter((entry) => entry.type === "aura").length,
      effectCount: bundle.registered.filter((entry) => entry.type === "effect").length,
      source: deepClone(library.source ?? {})
    };
    this.auraLibraries.set(id, normalized);
    return deepClone(normalized);
  }

  unregisterAuraLibrary(libraryId) {
    const id = String(libraryId ?? "");
    const existed = this.auraLibraries.delete(id);
    const removed = this.unregisterBundle(id);
    return existed || removed > 0;
  }

  getAuraLibrary(libraryId) {
    const value = this.auraLibraries.get(String(libraryId ?? ""));
    return value ? deepClone(value) : null;
  }

  listAuraLibraries(filters = {}) {
    return [...this.auraLibraries.values()].filter((entry) => {
      if (filters.moduleId && entry.moduleId !== filters.moduleId) return false;
      if (filters.defaultEnabled != null && entry.defaultEnabled !== Boolean(filters.defaultEnabled)) return false;
      if (filters.tags?.length && !filters.tags.every((tag) => entry.tags.includes(tag))) return false;
      return true;
    }).map(deepClone).sort((a, b) => String(a.labelKey ?? a.label).localeCompare(String(b.labelKey ?? b.label)));
  }

  getDefaultAuraLibraryIds() { return this.listAuraLibraries({ defaultEnabled: true }).map((entry) => entry.id); }
  resolveAuraLibrarySelection(selected = []) {
    const requested = [...new Set((selected ?? []).map(String).filter(Boolean))];
    return requested.length ? requested : this.getDefaultAuraLibraryIds();
  }

  registerAfflictionLibrary(library, options = {}) {
    if (!library || typeof library !== "object") throw new TypeError("Affliction library must be an object.");
    const id = normalizeId(library.id);
    if (this.afflictionLibraries.has(id) && !options.replace) throw new Error(`Creature Forge affliction library '${id}' is already registered.`);
    if (this.afflictionLibraries.has(id) && options.replace) this.unregisterAfflictionLibrary(id);
    const moduleId = String(library.moduleId ?? options.moduleId ?? id.split(".")[0]);
    const version = String(library.version ?? "0.0.0");
    const content = normalizedAfflictionLibraryContent(library);
    const bundle = this.registerBundle({ id, moduleId, version, content }, { libraryId: id, replace: Boolean(options.replace) });
    const normalized = {
      id, moduleId, version,
      label: library.label ?? id,
      labelKey: library.labelKey ?? null,
      description: library.description ?? "",
      descriptionKey: library.descriptionKey ?? null,
      defaultEnabled: library.defaultEnabled !== false,
      tags: [...new Set(library.tags ?? [])],
      afflictionCount: bundle.registered.filter((entry) => entry.type === "affliction").length,
      effectCount: bundle.registered.filter((entry) => entry.type === "effect").length,
      source: deepClone(library.source ?? {})
    };
    this.afflictionLibraries.set(id, normalized);
    return deepClone(normalized);
  }

  unregisterAfflictionLibrary(libraryId) {
    const id = String(libraryId ?? "");
    const existed = this.afflictionLibraries.delete(id);
    const removed = this.unregisterBundle(id);
    return existed || removed > 0;
  }

  getAfflictionLibrary(libraryId) {
    const value = this.afflictionLibraries.get(String(libraryId ?? ""));
    return value ? deepClone(value) : null;
  }

  listAfflictionLibraries(filters = {}) {
    return [...this.afflictionLibraries.values()].filter((entry) => {
      if (filters.moduleId && entry.moduleId !== filters.moduleId) return false;
      if (filters.defaultEnabled != null && entry.defaultEnabled !== Boolean(filters.defaultEnabled)) return false;
      if (filters.tags?.length && !filters.tags.every((tag) => entry.tags.includes(tag))) return false;
      return true;
    }).map(deepClone).sort((a, b) => String(a.labelKey ?? a.label).localeCompare(String(b.labelKey ?? b.label)));
  }

  getDefaultAfflictionLibraryIds() { return this.listAfflictionLibraries({ defaultEnabled: true }).map((entry) => entry.id); }
  resolveAfflictionLibrarySelection(selected = []) {
    const requested = [...new Set((selected ?? []).map(String).filter(Boolean))];
    return requested.length ? requested : this.getDefaultAfflictionLibraryIds();
  }

  unregisterAbilityLibrary(libraryId) {
    const id = String(libraryId ?? "");
    const existed = this.abilityLibraries.delete(id);
    const removed = this.unregisterBundle(id);
    return existed || removed > 0;
  }

  getAbilityLibrary(libraryId) {
    const value = this.abilityLibraries.get(String(libraryId ?? ""));
    return value ? deepClone(value) : null;
  }

  listAbilityLibraries(filters = {}) {
    return [...this.abilityLibraries.values()].filter((entry) => {
      if (filters.moduleId && entry.moduleId !== filters.moduleId) return false;
      if (filters.defaultEnabled != null && entry.defaultEnabled !== Boolean(filters.defaultEnabled)) return false;
      if (filters.tags?.length && !filters.tags.every((tag) => entry.tags.includes(tag))) return false;
      return true;
    }).map(deepClone).sort((a, b) => String(a.labelKey ?? a.label).localeCompare(String(b.labelKey ?? b.label)));
  }

  getDefaultAbilityLibraryIds() {
    return this.listAbilityLibraries({ defaultEnabled: true }).map((entry) => entry.id);
  }

  resolveAbilityLibrarySelection(selected = []) {
    const requested = [...new Set((selected ?? []).map(String).filter(Boolean))];
    return requested.length ? requested : this.getDefaultAbilityLibraryIds();
  }

  validateAbilityDependencies(definitionOrId) {
    const ability = typeof definitionOrId === "string" ? this.get("ability", definitionOrId) : deepClone(definitionOrId);
    if (!ability) return { valid: false, errors: [{ code: "ABILITY_NOT_FOUND", ref: String(definitionOrId ?? "") }], missing: [] };
    const errors = [];
    const missing = [];
    const required = [];

    for (const application of ability.applications ?? []) {
      if (!application?.ref) continue;
      const type = application.type;
      if (["effect", "aura", "affliction"].includes(type)) required.push({ type, ref: String(application.ref), source: "application" });
    }
    for (const value of ability.requirements?.requiredContent ?? []) {
      if (typeof value === "string") {
        const [type, ...rest] = value.split(":");
        if (rest.length) required.push({ type, ref: rest.join(":"), source: "requirement" });
      } else if (value?.type && value?.ref) required.push({ type: String(value.type), ref: String(value.ref), source: "requirement" });
    }

    for (const dep of required) {
      if (!CONTENT_TYPES.includes(dep.type)) {
        errors.push({ code: "ABILITY_DEPENDENCY_TYPE_UNKNOWN", type: dep.type, ref: dep.ref });
        continue;
      }
      if (!this.get(dep.type, dep.ref)) missing.push(dep);
    }
    if (missing.length) errors.push({ code: "ABILITY_DEPENDENCY_MISSING", missing: deepClone(missing) });
    return { valid: errors.length === 0, errors, missing, required };
  }

  validateAbilityLibrary(libraryId) {
    const library = this.getAbilityLibrary(libraryId);
    if (!library) return { valid: false, errors: [{ code: "ABILITY_LIBRARY_NOT_FOUND", libraryId }], abilities: [] };
    const abilities = this.list("ability", { libraryId: library.id });
    const results = abilities.map((ability) => ({ id: ability.id, ...this.validateAbilityDependencies(ability) }));
    return {
      valid: results.every((entry) => entry.valid),
      errors: results.flatMap((entry) => entry.errors.map((error) => ({ abilityId: entry.id, ...error }))),
      abilities: results
    };
  }

  get(type, id) {
    const value = this.maps.get(assertType(type))?.get(String(id));
    return value ? deepClone(value) : null;
  }

  list(type, filters = {}) {
    const values = [...(this.maps.get(assertType(type))?.values() ?? [])];
    return values.filter((entry) => {
      if (filters.moduleId && entry.source?.moduleId !== filters.moduleId) return false;
      if (filters.bundleId && entry.source?.bundleId !== filters.bundleId) return false;
      if (filters.libraryId && entry.source?.libraryId !== filters.libraryId) return false;
      if (filters.libraryIds?.length && entry.source?.libraryId && !filters.libraryIds.includes(entry.source.libraryId)) return false;
      if (filters.compendiumIds?.length && entry.source?.sourceKind === "compendium" && !filters.compendiumIds.includes(entry.source?.compendiumId)) return false;
      if (filters.tags?.length) {
        const tags = new Set(entry.tags ?? []);
        if (!filters.tags.every((tag) => tags.has(tag))) return false;
      }
      return true;
    }).map(deepClone);
  }

  resolve(type, value, { compendiumIds = [] } = {}) {
    const contentType = assertType(type);
    const target = String(value ?? "");
    const all = [...(this.maps.get(contentType)?.values() ?? [])];
    const exact = all.find((entry) => entry.id === target);
    if (exact) {
      if (exact.source?.sourceKind !== "compendium" || !compendiumIds.length || compendiumIds.includes(exact.source?.compendiumId)) return deepClone(exact);
      return null;
    }

    const candidates = all.filter((entry) => entry.slug === target);
    const permanent = candidates.find((entry) => entry.source?.sourceKind !== "compendium");
    if (permanent) return deepClone(permanent);
    if (!compendiumIds.length) return null;
    for (const compendiumId of compendiumIds) {
      const discovered = candidates.find((entry) => entry.source?.compendiumId === compendiumId);
      if (discovered) return deepClone(discovered);
    }
    return null;
  }

  listResolved(type, { compendiumIds = [] } = {}) {
    const contentType = assertType(type);
    const entries = this.list(contentType).filter((entry) => {
      if (entry.source?.sourceKind !== "compendium") return true;
      return compendiumIds.includes(entry.source?.compendiumId);
    });
    const byKey = new Map();
    for (const entry of entries) {
      const key = entry.slug ?? entry.id;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { ...entry, discoveredSources: entry.source?.sourceKind === "compendium" ? [entry.source.compendiumId] : [] });
        continue;
      }
      if (entry.source?.sourceKind === "compendium") existing.discoveredSources = [...new Set([...(existing.discoveredSources ?? []), entry.source.compendiumId])];
      const currentCategories = existing.supports?.categories ?? existing.selection?.categories ?? [];
      const incomingCategories = entry.supports?.categories ?? entry.selection?.categories ?? [];
      if (currentCategories.length || incomingCategories.length) {
        existing.supports = { ...(existing.supports ?? existing.selection ?? {}), categories: [...new Set([...currentCategories, ...incomingCategories])] };
      }
    }
    return [...byKey.values()].map(deepClone);
  }

  query(type, context = {}) {
    const category = context.category ?? context.identity?.category;
    const subtypes = new Set(context.subtypes ?? context.identity?.subtypes ?? []);
    const role = context.role ?? context.identity?.role;
    const level = Number(context.level ?? context.identity?.level ?? 0);
    return this.list(type).filter((entry) => {
      const selection = entry.selection ?? entry.supports ?? {};
      const categories = selection.categories ?? [];
      if (categories.length && category && !categories.includes(category)) return false;
      const requiredSubtypes = selection.requiredSubtypes ?? [];
      if (requiredSubtypes.some((value) => !subtypes.has(value))) return false;
      const anySubtypes = selection.anySubtypes ?? selection.subtypes ?? [];
      if (anySubtypes.length && !anySubtypes.some((value) => subtypes.has(value))) return false;
      const roles = selection.roles ?? [];
      if (roles.length && role && !roles.includes(role)) return false;
      const minimumLevel = Number(selection.minimumLevel ?? entry.minimumLevel ?? -1);
      const maximumLevel = Number(selection.maximumLevel ?? entry.maximumLevel ?? 24);
      return level >= minimumLevel && level <= maximumLevel;
    });
  }

  unregister(type, id) {
    return this.maps.get(assertType(type))?.delete(String(id)) ?? false;
  }

  unregisterBundle(bundleId) {
    const id = String(bundleId);
    const entries = this.bundleIndex.get(id);
    if (!entries) return 0;
    let count = 0;
    for (const key of entries) {
      const separator = key.indexOf(":");
      const type = key.slice(0, separator);
      const contentId = key.slice(separator + 1);
      if (this.maps.get(type)?.delete(contentId)) count += 1;
    }
    this.bundleIndex.delete(id);
    this.abilityLibraries.delete(id);
    this.auraLibraries.delete(id);
    this.afflictionLibraries.delete(id);
    return count;
  }

  clear() {
    for (const map of this.maps.values()) map.clear();
    this.bundleIndex.clear();
    this.abilityLibraries.clear();
    this.auraLibraries.clear();
    this.afflictionLibraries.clear();
    this.diagnostics = [];
  }

  getDiagnostics() {
    return deepClone(this.diagnostics);
  }

  snapshot() {
    return {
      ...Object.fromEntries(CONTENT_TYPES.map((type) => [type, this.list(type)])),
      abilityLibraries: this.listAbilityLibraries(),
      auraLibraries: this.listAuraLibraries(),
      afflictionLibraries: this.listAfflictionLibraries()
    };
  }
}
