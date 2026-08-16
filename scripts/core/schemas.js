import { BLUEPRINT_SCHEMA_VERSION, REQUEST_SCHEMA_VERSION } from "../constants.js";
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
    focus: []
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
  request.abilities.focus = [...new Set((request.abilities?.focus ?? []).map((value) => String(value).trim().toLowerCase()).filter(Boolean))];
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
      generatorVersion: "0.3.2",
      seed: "",
      variation: "balanced",
      requestSnapshot: null,
      rerollHistory: []
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
      policy: "auto",
      result: null
    },
    locks: {},
    provenance: [],
    diagnostics: []
  };
}

export function cloneBlueprint(blueprint) {
  return deepClone(blueprint);
}
