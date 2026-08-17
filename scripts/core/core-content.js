import { CORE_ABILITY_LIBRARY_ID, CORE_AURA_LIBRARY_ID, CORE_AFFLICTION_LIBRARY_ID, MODULE_ID, MODULE_VERSION } from "../constants.js";
import { CORE_ABILITIES, CORE_EFFECTS } from "./core-abilities.js";
import { CORE_AURAS, CORE_AFFLICTIONS } from "./core-special-features.js";

const category = (slug, label, extra = {}) => ({
  id: `${MODULE_ID}.category.${slug}`,
  slug,
  trait: slug,
  label,
  tags: ["core", "creature-category"],
  ...extra
});

const categories = [
  category("aberration", "PF2E_CREATURE_FORGE.Category.Aberration"),
  category("astral", "PF2E_CREATURE_FORGE.Category.Astral"),
  category("ethereal", "PF2E_CREATURE_FORGE.Category.Ethereal"),
  category("monitor", "PF2E_CREATURE_FORGE.Category.Monitor"),
  category("beast", "PF2E_CREATURE_FORGE.Category.Beast"),
  category("celestial", "PF2E_CREATURE_FORGE.Category.Celestial", {
    grantedTraits: ["holy"],
    defensiveAffinities: [
      { id: "unholy-weakness", kind: "weakness", type: "unholy", scale: "maximum", priority: 30 }
    ]
  }),
  category("dragon", "PF2E_CREATURE_FORGE.Category.Dragon"),
  category("elemental", "PF2E_CREATURE_FORGE.Category.Elemental", {
    defensiveAffinities: [
      { id: "bleed-immunity", kind: "immunity", type: "bleed" },
      { id: "poison-immunity", kind: "immunity", type: "poison" },
      { id: "paralyzed-immunity", kind: "immunity", type: "paralyzed" },
      { id: "unconscious-immunity", kind: "immunity", type: "unconscious" }
    ]
  }),
  category("fey", "PF2E_CREATURE_FORGE.Category.Fey", {
    defensiveAffinities: [
      { id: "cold-iron-weakness", kind: "weakness", type: "cold-iron", scale: "maximum", priority: 20 }
    ]
  }),
  category("fungus", "PF2E_CREATURE_FORGE.Category.Fungus", {
    defensiveAffinities: [
      { id: "mindless-mental-immunity", kind: "immunity", type: "mental", when: { subtypesAll: ["mindless"] } },
      { id: "fire-weakness", kind: "weakness", type: "fire", scale: "maximum", chance: { conservative: 0.15, balanced: 0.3, experimental: 0.45 }, priority: 5 }
    ]
  }),
  category("humanoid", "PF2E_CREATURE_FORGE.Category.Humanoid"),
  category("construct", "PF2E_CREATURE_FORGE.Category.Construct", {
    defensiveAffinities: [
      { id: "bleed-immunity", kind: "immunity", type: "bleed", priority: 50 },
      { id: "death-effects-immunity", kind: "immunity", type: "death-effects", priority: 50 },
      { id: "disease-immunity", kind: "immunity", type: "disease", priority: 50 },
      { id: "doomed-immunity", kind: "immunity", type: "doomed", priority: 50 },
      { id: "drained-immunity", kind: "immunity", type: "drained", priority: 50 },
      { id: "fatigued-immunity", kind: "immunity", type: "fatigued", priority: 50 },
      { id: "healing-immunity", kind: "immunity", type: "healing", priority: 50 },
      { id: "nonlethal-immunity", kind: "immunity", type: "nonlethal-attacks", priority: 50 },
      { id: "paralyzed-immunity", kind: "immunity", type: "paralyzed", priority: 50 },
      { id: "poison-immunity", kind: "immunity", type: "poison", priority: 50 },
      { id: "sickened-immunity", kind: "immunity", type: "sickened", priority: 50 },
      { id: "spirit-immunity", kind: "immunity", type: "spirit", priority: 50 },
      { id: "unconscious-immunity", kind: "immunity", type: "unconscious", priority: 50 },
      { id: "vitality-immunity", kind: "immunity", type: "vitality", priority: 50 },
      { id: "void-immunity", kind: "immunity", type: "void", priority: 50 },
      { id: "mindless-mental-immunity", kind: "immunity", type: "mental", when: { subtypesAll: ["mindless"] }, priority: 60 }
    ]
  }),
  category("plant", "PF2E_CREATURE_FORGE.Category.Plant", {
    defensiveAffinities: [
      { id: "mindless-mental-immunity", kind: "immunity", type: "mental", when: { subtypesAll: ["mindless"] } },
      { id: "fire-weakness", kind: "weakness", type: "fire", scale: "maximum", chance: { conservative: 0.15, balanced: 0.25, experimental: 0.4 }, priority: 5 }
    ]
  }),
  category("giant", "PF2E_CREATURE_FORGE.Category.Giant"),
  category("fiend", "PF2E_CREATURE_FORGE.Category.Fiend", {
    grantedTraits: ["unholy"],
    defensiveAffinities: [
      { id: "holy-weakness", kind: "weakness", type: "holy", scale: "maximum", priority: 30 }
    ]
  }),
  category("ooze", "PF2E_CREATURE_FORGE.Category.Ooze"),
  category("animal", "PF2E_CREATURE_FORGE.Category.Animal"),
  category("undead", "PF2E_CREATURE_FORGE.Category.Undead", {
    defensiveAffinities: [
      { id: "poison-immunity", kind: "immunity", type: "poison" },
      { id: "disease-immunity", kind: "immunity", type: "disease" },
      { id: "paralyzed-immunity", kind: "immunity", type: "paralyzed" },
      { id: "unconscious-immunity", kind: "immunity", type: "unconscious" },
      { id: "death-effects-immunity", kind: "immunity", type: "death-effects" },
      { id: "mindless-mental-immunity", kind: "immunity", type: "mental", when: { subtypesAll: ["mindless"] }, priority: 60 }
    ]
  })
];

const subtype = (slug, extra = {}) => ({
  id: `${MODULE_ID}.subtype.${slug}`,
  slug,
  trait: slug,
  label: `PF2E_CREATURE_FORGE.Subtype.${slug}`,
  tags: ["core", "creature-subtype"],
  ...extra
});

const subtypes = [
  subtype("amphibious"),
  subtype("aquatic"),
  subtype("mindless", {
    defensiveAffinities: [{ id: "mental-immunity", kind: "immunity", type: "mental", priority: 100 }]
  }),
  subtype("incorporeal", {
    defensiveAffinities: [
      { id: "paralyzed-immunity", kind: "immunity", type: "paralyzed" },
      { id: "poison-immunity", kind: "immunity", type: "poison" },
      { id: "disease-immunity", kind: "immunity", type: "disease" },
      { id: "precision-immunity", kind: "immunity", type: "precision" },
      {
        id: "incorporeal-resistance",
        kind: "resistance",
        type: "all-damage",
        scale: "minimum",
        exceptions: ["force", "ghost-touch", "spirit"],
        doubleVs: ["non-magical"],
        priority: 40
      }
    ]
  }),
  subtype("ghost", {
    supports: { categories: ["undead"] },
    impliedSubtypes: ["incorporeal"]
  }),
  subtype("swarm", {
    defensiveAffinities: [
      { id: "precision-immunity", kind: "immunity", type: "precision" },
      { id: "grabbed-immunity", kind: "immunity", type: "grabbed" },
      { id: "prone-immunity", kind: "immunity", type: "prone" },
      { id: "restrained-immunity", kind: "immunity", type: "restrained" },
      { id: "area-weakness", kind: "weakness", type: "area-damage", scale: "maximum", hpMultiplier: 1, priority: 20 },
      { id: "physical-resistance", kind: "resistance", type: "physical", scale: "minimum", priority: 20 }
    ]
  }),
  subtype("air"),
  subtype("earth"),
  subtype("fire", {
    defensiveAffinities: [
      { id: "fire-immunity", kind: "immunity", type: "fire", priority: 60 },
      { id: "cold-resistance", kind: "resistance", type: "cold", scale: "maximum", priority: 10 }
    ]
  }),
  subtype("metal"),
  subtype("water"),
  subtype("wood", {
    defensiveAffinities: [
      { id: "fire-weakness", kind: "weakness", type: "fire", scale: "maximum", hpMultiplier: 1, priority: 15 },
      { id: "axe-weakness", kind: "weakness", type: "axe-vulnerability", scale: "maximum", hpMultiplier: 1, priority: 15 }
    ]
  }),
  subtype("acid"),
  subtype("poison"),
  subtype("disease"),
  subtype("cold", {
    defensiveAffinities: [
      { id: "cold-elemental-immunity", kind: "immunity", type: "cold", when: { categories: ["elemental"] }, priority: 60 },
      { id: "cold-resistance", kind: "resistance", type: "cold", scale: "maximum", when: { notCategories: ["elemental"] }, priority: 10 }
    ]
  }),
  subtype("electricity"),
  subtype("holy", { grantedTraits: ["holy"], supports: { categories: ["celestial", "monitor", "humanoid"] } }),
  subtype("unholy", { grantedTraits: ["unholy"], supports: { categories: ["fiend", "undead", "humanoid"] } }),
  subtype("angel", { supports: { categories: ["celestial"] }, impliedSubtypes: ["holy"] }),
  subtype("azata", {
    supports: { categories: ["celestial"] },
    impliedSubtypes: ["holy"],
    defensiveAffinities: [{ id: "cold-iron-weakness", kind: "weakness", type: "cold-iron", scale: "maximum", priority: 40 }]
  }),
  subtype("daemon", {
    supports: { categories: ["fiend"] },
    impliedSubtypes: ["unholy"],
    defensiveAffinities: [{ id: "death-effects-immunity", kind: "immunity", type: "death-effects", priority: 40 }]
  }),
  subtype("demon", { supports: { categories: ["fiend"] }, impliedSubtypes: ["unholy"] }),
  subtype("devil", {
    supports: { categories: ["fiend"] },
    impliedSubtypes: ["unholy"],
    defensiveAffinities: [
      { id: "fire-immunity", kind: "immunity", type: "fire", priority: 60 },
      { id: "poison-resistance", kind: "resistance", type: "poison", scale: "maximum", priority: 25 },
      { id: "physical-resistance", kind: "resistance", type: "physical", scale: "minimum", exceptions: ["silver"], priority: 25 }
    ]
  }),
  subtype("psychopomp", {
    supports: { categories: ["monitor"] },
    defensiveAffinities: [
      { id: "disease-immunity", kind: "immunity", type: "disease" },
      { id: "death-effects-immunity", kind: "immunity", type: "death-effects" },
      { id: "poison-resistance", kind: "resistance", type: "poison", scale: "maximum" },
      { id: "void-resistance", kind: "resistance", type: "void", scale: "maximum" }
    ]
  }),
  subtype("protean", {
    supports: { categories: ["monitor"] },
    defensiveAffinities: [{ id: "precision-resistance", kind: "resistance", type: "precision", scale: "maximum" }]
  })
];

export const CORE_CONTENT_BUNDLE = Object.freeze({
  id: `${MODULE_ID}.core`,
  moduleId: MODULE_ID,
  version: MODULE_VERSION,
  apiVersion: 1,
  content: {
    categories,
    subtypes,
    nameTemplates: [],
    abilities: [],
    auras: [],
    afflictions: [],
    effects: [],
    poisons: [],
    spellProfiles: [],
    spellPackages: [],
    lootProfiles: []
  }
});

export const CORE_ABILITY_LIBRARY = Object.freeze({
  id: CORE_ABILITY_LIBRARY_ID,
  moduleId: MODULE_ID,
  version: MODULE_VERSION,
  labelKey: "PF2E_CREATURE_FORGE.AbilityLibrary.Core.Name",
  descriptionKey: "PF2E_CREATURE_FORGE.AbilityLibrary.Core.Description",
  defaultEnabled: true,
  tags: ["core", "ability-library"],
  content: {
    abilities: CORE_ABILITIES,
    effects: CORE_EFFECTS
  }
});


export const CORE_AURA_LIBRARY = Object.freeze({
  id: CORE_AURA_LIBRARY_ID,
  moduleId: MODULE_ID,
  version: MODULE_VERSION,
  labelKey: "PF2E_CREATURE_FORGE.AuraLibrary.Core.Name",
  descriptionKey: "PF2E_CREATURE_FORGE.AuraLibrary.Core.Description",
  defaultEnabled: true,
  tags: ["core", "aura-library"],
  content: { auras: CORE_AURAS, effects: [] }
});

export const CORE_AFFLICTION_LIBRARY = Object.freeze({
  id: CORE_AFFLICTION_LIBRARY_ID,
  moduleId: MODULE_ID,
  version: MODULE_VERSION,
  labelKey: "PF2E_CREATURE_FORGE.AfflictionLibrary.Core.Name",
  descriptionKey: "PF2E_CREATURE_FORGE.AfflictionLibrary.Core.Description",
  defaultEnabled: true,
  tags: ["core", "affliction-library"],
  content: { afflictions: CORE_AFFLICTIONS, effects: [] }
});

export function registerCoreContent(registry) {
  const bundle = registry.registerBundle(CORE_CONTENT_BUNDLE);
  const library = registry.registerAbilityLibrary(CORE_ABILITY_LIBRARY);
  const auraLibrary = registry.registerAuraLibrary(CORE_AURA_LIBRARY);
  const afflictionLibrary = registry.registerAfflictionLibrary(CORE_AFFLICTION_LIBRARY);
  return { bundle, library, auraLibrary, afflictionLibrary };
}
