import { MODULE_ID, MODULE_VERSION } from "../constants.js";

const categories = [
  ["aberration", "PF2E_CREATURE_FORGE.Category.Aberration"],
  ["astral", "PF2E_CREATURE_FORGE.Category.Astral"],
  ["ethereal", "PF2E_CREATURE_FORGE.Category.Ethereal"],
  ["monitor", "PF2E_CREATURE_FORGE.Category.Monitor"],
  ["beast", "PF2E_CREATURE_FORGE.Category.Beast"],
  ["celestial", "PF2E_CREATURE_FORGE.Category.Celestial"],
  ["dragon", "PF2E_CREATURE_FORGE.Category.Dragon"],
  ["elemental", "PF2E_CREATURE_FORGE.Category.Elemental"],
  ["fey", "PF2E_CREATURE_FORGE.Category.Fey"],
  ["fungus", "PF2E_CREATURE_FORGE.Category.Fungus"],
  ["humanoid", "PF2E_CREATURE_FORGE.Category.Humanoid"],
  ["construct", "PF2E_CREATURE_FORGE.Category.Construct"],
  ["plant", "PF2E_CREATURE_FORGE.Category.Plant"],
  ["giant", "PF2E_CREATURE_FORGE.Category.Giant"],
  ["fiend", "PF2E_CREATURE_FORGE.Category.Fiend"],
  ["ooze", "PF2E_CREATURE_FORGE.Category.Ooze"],
  ["animal", "PF2E_CREATURE_FORGE.Category.Animal"],
  ["undead", "PF2E_CREATURE_FORGE.Category.Undead"]
].map(([slug, label]) => ({
  id: `${MODULE_ID}.category.${slug}`,
  slug,
  trait: slug,
  label,
  tags: ["core", "creature-category"]
}));

const subtypeSlugs = [
  "amphibious", "aquatic", "mindless", "incorporeal", "swarm",
  "air", "earth", "fire", "metal", "water", "wood", "acid", "cold", "electricity"
];

const subtypes = subtypeSlugs.map((slug) => ({
  id: `${MODULE_ID}.subtype.${slug}`,
  slug,
  trait: slug,
  label: `PF2E_CREATURE_FORGE.Subtype.${slug}`,
  tags: ["core", "creature-subtype"]
}));

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

export function registerCoreContent(registry) {
  return registry.registerBundle(CORE_CONTENT_BUNDLE);
}
