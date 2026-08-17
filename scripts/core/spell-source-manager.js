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

function getProperty(object, path, fallback = undefined) {
  const viaFoundry = globalThis.foundry?.utils?.getProperty?.(object, path);
  if (viaFoundry !== undefined) return viaFoundry;
  return path.split(".").reduce((value, key) => value?.[key], object) ?? fallback;
}

function normalizeArray(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];
}

function deriveThemes(entry) {
  const traits = normalizeArray(getProperty(entry, "system.traits.value", []));
  const slug = String(getProperty(entry, "system.slug", "") ?? "").toLowerCase();
  const name = String(entry?.name ?? "").toLowerCase();
  const text = `${slug} ${name}`;
  const themes = new Set(traits);
  // Canonical PF2E traits are language-neutral and therefore make a much more
  // reliable thematic signal than localized spell names alone.
  const traitThemes = {
    teleportation: ["movement"],
    polymorph: ["transformation"],
    morph: ["transformation"],
    summon: ["summon"],
    healing: ["healing"],
    vitality: ["healing", "vitality"],
    void: ["void"],
    emotion: ["mental"],
    fear: ["fear", "mental"],
    illusion: ["illusion"],
    mental: ["mental"],
    darkness: ["darkness"],
    light: ["light"],
    detection: ["utility"],
    fortune: ["support"],
    misfortune: ["control"],
    incapacitation: ["control"],
    plant: ["nature", "plant"],
    wood: ["nature", "wood"],
    water: ["nature", "water"],
    air: ["nature", "air", "movement"],
    earth: ["nature", "earth"],
    fire: ["fire"],
    cold: ["cold"],
    electricity: ["electricity"],
    acid: ["acid"],
    poison: ["poison"],
    disease: ["disease"],
    holy: ["holy"],
    unholy: ["unholy"],
    spirit: ["spirit"]
  };
  for (const trait of traits) for (const theme of traitThemes[trait] ?? []) themes.add(theme);
  const keywordThemes = {
    fire: ["fire", "flame", "burn", "blazing", "fiery", "scorch"],
    cold: ["cold", "frost", "ice", "winter", "chill", "frozen"],
    electricity: ["electric", "lightning", "shock", "thunder", "storm"],
    acid: ["acid", "corros"],
    poison: ["poison", "venom", "toxic"],
    disease: ["disease", "plague", "pestil", "contag"],
    fear: ["fear", "terror", "fright", "dread"],
    mental: ["mental", "mind", "thought", "psych", "dream", "nightmare"],
    illusion: ["illusion", "phantasm", "figment", "mirage", "invis"],
    darkness: ["dark", "shadow", "gloom", "night"],
    light: ["light", "radiant", "sun", "dawn"],
    healing: ["heal", "soothe", "restore", "vital"],
    vitality: ["vitality", "life", "heal"],
    void: ["void", "negative", "death", "necrom", "vampir"],
    spirit: ["spirit", "soul", "ghost", "haunt"],
    control: ["wall", "slow", "bind", "paraly", "web", "entangle", "command", "dominate"],
    movement: ["teleport", "blink", "jump", "fly", "step", "stride", "dimension", "warp"],
    summon: ["summon", "conjure", "call"],
    protection: ["shield", "armor", "ward", "protect", "resist"],
    transformation: ["form", "shape", "polymorph", "transform", "enlarge", "shrink"],
    nature: ["plant", "animal", "wood", "vine", "earth", "water", "air", "weather"],
    holy: ["holy", "divine", "angel", "celestial"],
    unholy: ["unholy", "demon", "devil", "infernal", "diabolic"]
  };
  for (const [theme, keywords] of Object.entries(keywordThemes)) {
    if (keywords.some((keyword) => text.includes(keyword))) themes.add(theme);
  }
  const damage = getProperty(entry, "system.damage", {}) ?? {};
  for (const part of Object.values(damage)) if (part?.type) themes.add(String(part.type));
  const defense = getProperty(entry, "system.defense", null);
  if (defense?.save) themes.add("save");
  if (defense?.passive?.statistic === "ac") themes.add("attack-roll");
  const area = getProperty(entry, "system.area", null);
  if (area) themes.add("area");
  return [...themes];
}

function normalizeSpellEntry(entry, pack) {
  const level = Number(getProperty(entry, "system.level.value", 0));
  const ritual = getProperty(entry, "system.ritual", null);
  const traditions = normalizeArray(getProperty(entry, "system.traits.traditions", []));
  const traits = normalizeArray(getProperty(entry, "system.traits.value", []));
  const id = String(entry?._id ?? entry?.id ?? "");
  const collection = packId(pack);
  return {
    id: `${collection}:${id}`,
    documentId: id,
    sourceUuid: String(entry?.uuid ?? `Compendium.${collection}.Item.${id}`),
    compendiumId: collection,
    compendiumLabel: packLabel(pack),
    name: String(entry?.name ?? getProperty(entry, "system.slug", id) ?? id),
    img: entry?.img ?? "icons/svg/book.svg",
    slug: String(getProperty(entry, "system.slug", "") ?? ""),
    level,
    traits,
    traditions,
    rarity: String(getProperty(entry, "system.traits.rarity", "common") ?? "common"),
    ritual: Boolean(ritual),
    cantrip: traits.includes("cantrip"),
    focus: traits.includes("focus"),
    area: deepClone(getProperty(entry, "system.area", null)),
    defense: deepClone(getProperty(entry, "system.defense", null)),
    themes: deriveThemes(entry),
    source: {
      sourceKind: "compendium",
      compendiumId: collection,
      compendiumLabel: packLabel(pack),
      packageName: pack?.metadata?.packageName ?? pack?.metadata?.package ?? "",
      packageType: pack?.metadata?.packageType ?? ""
    }
  };
}

export class SpellSourceManager {
  constructor() {
    this.cache = new Map();
    this.diagnostics = [];
  }

  listCompendiums() {
    const packs = [...(globalThis.game?.packs ?? [])];
    return packs
      .filter((pack) => String(documentName(pack)).toLowerCase() === "item")
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

  getDefaultSourceIds() {
    const available = this.listCompendiums();
    const official = available.find((entry) => entry.id === "pf2e.spells-srd");
    if (official) return [official.id];
    const likely = available.find((entry) => /spell/i.test(`${entry.id} ${entry.label}`));
    return likely ? [likely.id] : [];
  }

  resolveSelection(selected = []) {
    const requested = [...new Set((selected ?? []).map(String).filter(Boolean))];
    return requested.length ? requested : this.getDefaultSourceIds();
  }

  getPack(id) {
    const target = String(id ?? "");
    const packs = globalThis.game?.packs;
    if (packs?.get) return packs.get(target) ?? null;
    return [...(packs ?? [])].find((pack) => packId(pack) === target) ?? null;
  }

  async scan(compendiumId, { force = false } = {}) {
    const id = String(compendiumId ?? "").trim();
    if (!id) throw new Error("A spell compendium id is required.");
    if (!force && this.cache.has(id)) return deepClone(this.cache.get(id));
    const pack = this.getPack(id);
    if (!pack) throw new Error(`Spell compendium '${id}' is not available.`);
    if (String(documentName(pack)).toLowerCase() !== "item") throw new Error(`Compendium '${id}' is not an Item compendium.`);
    try {
      const index = await pack.getIndex({ fields: [
        "type", "img", "system.slug", "system.level.value", "system.traits.value", "system.traits.traditions",
        "system.traits.rarity", "system.ritual", "system.area", "system.defense", "system.damage"
      ] });
      const spells = indexValues(index)
        .filter((entry) => String(entry?.type ?? "").toLowerCase() === "spell")
        .map((entry) => normalizeSpellEntry(entry, pack))
        .filter((entry) => entry.documentId && !entry.ritual && !entry.focus);
      const result = { id, label: packLabel(pack), spellCount: spells.length, spells };
      this.cache.set(id, result);
      return deepClone(result);
    } catch (error) {
      this.diagnostics.push({ level: "error", code: "SPELL_COMPENDIUM_SCAN_FAILED", compendiumId: id, message: error.message });
      throw error;
    }
  }

  async ensure(sources = {}, { force = false } = {}) {
    const ids = this.resolveSelection(sources?.spells ?? []);
    const results = [];
    for (const id of ids) results.push(await this.scan(id, { force }));
    return { sources: ids, scanned: results };
  }

  listSpells(selectedSources = []) {
    const ids = this.resolveSelection(selectedSources);
    return ids.flatMap((id) => this.cache.get(id)?.spells ?? []).map(deepClone);
  }

  isPrepared(sources = {}) {
    return this.resolveSelection(sources?.spells ?? []).every((id) => this.cache.has(id));
  }

  status() {
    return { defaults: this.getDefaultSourceIds(), cached: [...this.cache.keys()], diagnostics: deepClone(this.diagnostics) };
  }

  clearCache() { this.cache.clear(); }
}
