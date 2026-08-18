import { BLUEPRINT_SCHEMA_VERSION, MODULE_VERSION, REQUEST_SCHEMA_VERSION } from "../constants.js";
import { deepClone, deepMerge } from "./clone.js";

export const DEFAULT_REQUEST = Object.freeze({
  schemaVersion: REQUEST_SCHEMA_VERSION,
  identity: {
    name: "",
    level: 1,
    role: "custom",
    category: "humanoid",
    subtypes: [],
    size: "med"
  },
  attributes: {
    str: "role",
    dex: "role",
    con: "role",
    int: "role",
    wis: "role",
    cha: "role"
  },
  defenses: {
    ac: "role",
    hp: "role",
    perception: "role",
    saves: {
      fortitude: "role",
      reflex: "role",
      will: "role"
    }
  },
  defensiveAffinities: {
    mode: "auto",
    hpCompensation: "auto",
    immunities: [],
    resistances: [],
    weaknesses: []
  },
  offense: {
    attack: "role",
    damage: "role",
    kind: "role",
    damageType: "auto"
  },
  skills: {
    count: "role",
    primaryRank: "role",
    preferred: []
  },
  movement: {
    land: "role",
    climb: "auto",
    swim: "auto",
    fly: "auto",
    burrow: "auto"
  },
  senses: {
    lowLightVision: "auto",
    darkvision: "auto",
    scent: "auto",
    scentRange: 30
  },
  abilities: {
    mode: "auto",
    count: "role",
    complexity: "standard",
    powerBudget: "auto",
    focus: []
  },
  specialFeatures: {
    frequency: "normal",
    auras: { mode: "auto" },
    afflictions: { mode: "auto" }
  },
  spellcasting: {
    mode: "auto",
    style: "auto",
    tradition: "auto",
    dcRank: "role",
    highestRank: "auto",
    breadth: "standard",
    themes: []
  },
  loot: {
    mode: "auto",
    equipment: { mode: "auto" },
    salvage: { mode: "auto" },
    hoard: { mode: "auto" },
    signature: { mode: "auto" },
    treasureProfile: "standard",
    hoardProfile: "hoard",
    environment: "generic",
    useItemForge: true
  },
  generation: {
    seed: "",
    variation: "balanced"
  },
  sources: {
    categories: [],
    subtypes: [],
    abilities: [],
    auras: [],
    afflictions: [],
    effects: [],
    spells: [],
    loot: []
  },
  options: {
    attackCount: 1,
    spellcasting: "auto",
    auras: "auto",
    afflictions: "auto",
    loot: "auto"
  }
});

export function createGenerationRequest(input = {}) {
  const request = deepMerge(DEFAULT_REQUEST, input);
  request.schemaVersion = REQUEST_SCHEMA_VERSION;
  request.identity.subtypes = [...new Set((request.identity.subtypes ?? []).map((value) => String(value).trim()).filter(Boolean))];
  request.generation.seed = String(request.generation.seed ?? "").trim();
  for (const key of ["categories", "subtypes", "abilities", "auras", "afflictions", "effects", "spells", "loot"]) {
    request.sources[key] = [...new Set((request.sources?.[key] ?? []).map((value) => String(value).trim()).filter(Boolean))];
  }
  request.skills.preferred = [...new Set((request.skills?.preferred ?? []).map((value) => String(value).trim().toLowerCase()).filter(Boolean))];
  request.abilities.mode = request.abilities?.mode === "off" ? "off" : "auto";
  if (request.abilities.count !== "role") request.abilities.count = Math.max(0, Math.min(5, Number(request.abilities.count ?? 2)));
  request.abilities.complexity = ["simple", "standard", "complex"].includes(request.abilities?.complexity) ? request.abilities.complexity : "standard";
  if (request.abilities.powerBudget !== "auto") request.abilities.powerBudget = Math.max(0, Math.min(30, Number(request.abilities.powerBudget ?? 0)));
  request.abilities.focus = [...new Set((request.abilities?.focus ?? []).map((value) => String(value).trim().toLowerCase()).filter(Boolean))];
  request.specialFeatures.frequency = ["rare", "normal", "high"].includes(request.specialFeatures?.frequency) ? request.specialFeatures.frequency : "normal";
  const normalizeSpecialMode = (value) => ["auto", "none", "required"].includes(value) ? value : "auto";
  request.specialFeatures.auras.mode = normalizeSpecialMode(request.specialFeatures?.auras?.mode);
  request.specialFeatures.afflictions.mode = normalizeSpecialMode(request.specialFeatures?.afflictions?.mode);
  const normalizeSpellMode = (value) => ["auto", "none", "required"].includes(value) ? value : (value === "off" ? "none" : value === "on" ? "required" : "auto");
  request.spellcasting.mode = normalizeSpellMode(request.spellcasting?.mode);
  if (input?.spellcasting?.mode == null && input?.options?.spellcasting != null) {
    request.spellcasting.mode = normalizeSpellMode(input.options.spellcasting);
  }
  request.spellcasting.style = ["auto", "innate", "prepared", "spontaneous"].includes(request.spellcasting?.style) ? request.spellcasting.style : "auto";
  request.spellcasting.tradition = ["auto", "arcane", "divine", "occult", "primal"].includes(request.spellcasting?.tradition) ? request.spellcasting.tradition : "auto";
  request.spellcasting.dcRank = ["role", "moderate", "high", "extreme"].includes(request.spellcasting?.dcRank) ? request.spellcasting.dcRank : "role";
  if (request.spellcasting.highestRank !== "auto") request.spellcasting.highestRank = Math.max(1, Math.min(10, Number(request.spellcasting.highestRank ?? 1)));
  request.spellcasting.breadth = ["focused", "standard", "broad"].includes(request.spellcasting?.breadth) ? request.spellcasting.breadth : "standard";
  request.spellcasting.themes = [...new Set((request.spellcasting?.themes ?? []).map((value) => String(value).trim().toLowerCase()).filter(Boolean))];
  const normalizeLootMode = (value) => ["auto", "none", "required"].includes(value) ? value : (value === "off" ? "none" : value === "on" ? "required" : "auto");
  request.loot.mode = normalizeLootMode(request.loot?.mode ?? request.options?.loot);
  for (const channel of ["equipment", "salvage", "hoard", "signature"]) {
    request.loot[channel] ??= { mode: "auto" };
    request.loot[channel].mode = normalizeLootMode(request.loot[channel]?.mode);
  }
  request.loot.treasureProfile = ["poor", "standard", "rich", "boss", "hoard"].includes(request.loot?.treasureProfile) ? request.loot.treasureProfile : "standard";
  request.loot.hoardProfile = ["poor", "standard", "rich", "boss", "hoard"].includes(request.loot?.hoardProfile) ? request.loot.hoardProfile : "hoard";
  request.loot.environment = String(request.loot?.environment ?? "generic").trim() || "generic";
  request.loot.useItemForge = request.loot?.useItemForge !== false;
  // Backward-compatible 0.3.x option aliases.
  if (input?.specialFeatures?.auras?.mode == null && input?.options?.auras) {
    request.specialFeatures.auras.mode = input.options.auras === "off" || input.options.auras === "none" ? "none" : input.options.auras === "required" || input.options.auras === "on" ? "required" : "auto";
  }
  if (input?.specialFeatures?.afflictions?.mode == null && input?.options?.afflictions) {
    request.specialFeatures.afflictions.mode = input.options.afflictions === "off" || input.options.afflictions === "none" ? "none" : input.options.afflictions === "required" || input.options.afflictions === "on" ? "required" : "auto";
  }
  if (request.skills.count !== "role") request.skills.count = Math.max(0, Math.min(8, Number(request.skills.count ?? 3)));
  for (const type of ["land", "climb", "swim", "fly", "burrow"]) {
    const value = request.movement?.[type];
    if (typeof value === "number") request.movement[type] = Math.max(0, Math.round(value));
    else if (/^\d+$/.test(String(value ?? ""))) request.movement[type] = Math.max(0, Number(value));
  }
  request.senses.scentRange = Math.max(5, Math.round(Number(request.senses?.scentRange ?? 30) / 5) * 5);
  const normalizeAffinityEntries = (entries = []) => entries
    .filter((entry) => entry && typeof entry === "object" && String(entry.type ?? "").trim())
    .map((entry) => ({ ...deepClone(entry), type: String(entry.type).trim() }));
  request.defensiveAffinities.mode = request.defensiveAffinities?.mode === "off" ? "off" : "auto";
  request.defensiveAffinities.hpCompensation = request.defensiveAffinities?.hpCompensation === "off" ? "off" : "auto";
  request.defensiveAffinities.immunities = normalizeAffinityEntries(request.defensiveAffinities?.immunities);
  request.defensiveAffinities.resistances = normalizeAffinityEntries(request.defensiveAffinities?.resistances);
  request.defensiveAffinities.weaknesses = normalizeAffinityEntries(request.defensiveAffinities?.weaknesses);
  request.options.attackCount = Math.max(0, Math.min(2, Number(request.options.attackCount ?? 1)));
  return request;
}

export function createEmptyBlueprint() {
  return {
    schemaVersion: BLUEPRINT_SCHEMA_VERSION,
    metadata: {
      generator: "pf2e-creature-forge",
      generatorVersion: MODULE_VERSION,
      seed: "",
      variation: "balanced",
      requestSnapshot: null,
      rerollHistory: [],
      abilityBudget: { limit: 0, spent: 0, remaining: 0, requestedCount: 0, generatedCount: 0 },
      signatureBudget: { baseLimit: 0, bonus: 0, spent: 0, generatedCount: 0 },
      specialFeatureBudget: { limit: 0, spent: 0, remaining: 0, abilitySpent: 0, auraSpent: 0, afflictionSpent: 0, spellcastingSpent: 0, signatureSpent: 0 }
    },
    identity: {
      name: "Creature",
      level: 1,
      role: "custom",
      category: "humanoid",
      subtypes: [],
      resolvedSubtypes: [],
      traits: ["humanoid"],
      size: "med"
    },
    statistics: {
      abilities: {
        str: { rank: "moderate", value: 3 },
        dex: { rank: "moderate", value: 3 },
        con: { rank: "moderate", value: 3 },
        int: { rank: "moderate", value: 3 },
        wis: { rank: "moderate", value: 3 },
        cha: { rank: "moderate", value: 3 }
      },
      ac: { rank: "moderate", value: 15 },
      hp: { rank: "moderate", value: 20, range: { min: 19, max: 21 } },
      perception: { rank: "moderate", value: 7 },
      senses: [],
      skills: {},
      saves: {
        fortitude: { rank: "moderate", value: 7 },
        reflex: { rank: "moderate", value: 7 },
        will: { rank: "moderate", value: 7 }
      },
      speed: { land: 25, other: [] }
    },
    defenses: {
      immunities: [],
      resistances: [],
      weaknesses: [],
      hpAdjustment: { value: 0, reasons: [] }
    },
    combat: {
      attacks: [],
      spellcasting: []
    },
    abilities: [],
    resources: {
      effects: [],
      auras: [],
      afflictions: []
    },
    loot: {
      schemaVersion: 2,
      policy: "auto",
      generated: false,
      environment: "generic",
      treasureProfile: "standard",
      useItemForge: true,
      sourceCompendiums: [],
      channels: {
        equipment: { mode: "auto", selected: false, chance: 0, reason: "", result: null },
        salvage: { mode: "auto", selected: false, chance: 0, reason: "", result: null },
        hoard: { mode: "auto", selected: false, chance: 0, reason: "", result: null },
        signature: { mode: "auto", selected: false, chance: 0, reason: "", result: null }
      },
      diagnostics: [],
      summary: { selectedChannels: [], generatedChannels: [], carriedItemCount: 0, deferredItemCount: 0, totalValueGp: 0 }
    },
    locks: {},
    provenance: [],
    diagnostics: []
  };
}

export function cloneBlueprint(blueprint) {
  return deepClone(blueprint);
}
