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

export class ContentRegistry {
  constructor() {
    this.maps = new Map(CONTENT_TYPES.map((type) => [type, new Map()]));
    this.bundleIndex = new Map();
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
      moduleId: String(options.moduleId ?? definition.source?.moduleId ?? MODULE_ID),
      bundleId: options.bundleId ? String(options.bundleId) : (definition.source?.bundleId ?? null),
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
    const mapping = {
      categories: "category",
      subtypes: "subtype",
      nameTemplates: "nameTemplate",
      abilities: "ability",
      auras: "aura",
      afflictions: "affliction",
      effects: "effect",
      poisons: "poison",
      spellProfiles: "spellProfile",
      spellPackages: "spellPackage",
      lootProfiles: "lootProfile"
    };
    const registered = [];
    try {
      for (const [key, type] of Object.entries(mapping)) {
        for (const definition of content[key] ?? []) {
          registered.push(this.register(type, definition, {
            moduleId,
            bundleId: id,
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

  get(type, id) {
    const value = this.maps.get(assertType(type))?.get(String(id));
    return value ? deepClone(value) : null;
  }

  list(type, filters = {}) {
    const values = [...(this.maps.get(assertType(type))?.values() ?? [])];
    return values.filter((entry) => {
      if (filters.moduleId && entry.source?.moduleId !== filters.moduleId) return false;
      if (filters.bundleId && entry.source?.bundleId !== filters.bundleId) return false;
      if (filters.tags?.length) {
        const tags = new Set(entry.tags ?? []);
        if (!filters.tags.every((tag) => tags.has(tag))) return false;
      }
      return true;
    }).map(deepClone);
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
    return count;
  }

  clear() {
    for (const map of this.maps.values()) map.clear();
    this.bundleIndex.clear();
    this.diagnostics = [];
  }

  getDiagnostics() {
    return deepClone(this.diagnostics);
  }

  snapshot() {
    return Object.fromEntries(CONTENT_TYPES.map((type) => [type, this.list(type)]));
  }
}
