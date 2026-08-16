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
  offense: {
    attack: "role",
    damage: "role",
    kind: "role",
    damageType: "auto"
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
  request.options.attackCount = Math.max(0, Math.min(2, Number(request.options.attackCount ?? 1)));
  return request;
}

export function createEmptyBlueprint() {
  return {
    schemaVersion: BLUEPRINT_SCHEMA_VERSION,
    metadata: {
      generator: "pf2e-creature-forge",
      generatorVersion: "0.1.3",
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
      saves: {
        fortitude: { rank: "moderate", value: 7 },
        reflex: { rank: "moderate", value: 7 },
        will: { rank: "moderate", value: 7 }
      },
      speed: { land: 25, other: [] }
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
