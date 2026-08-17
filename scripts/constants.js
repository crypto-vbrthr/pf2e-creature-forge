export const MODULE_ID = "pf2e-creature-forge";
export const MODULE_VERSION = "0.3.8";
export const API_VERSION = "0.3.8";
export const REQUEST_SCHEMA_VERSION = 4;
export const BLUEPRINT_SCHEMA_VERSION = 4;
export const CONTENT_SCHEMA_VERSION = 4;

export const CORE_ABILITY_LIBRARY_ID = `${MODULE_ID}.ability-library.core`;

export const SETTINGS = Object.freeze({
  WINDOW_STATE: "windowState",
  SOURCE_DEFAULTS: "sourceDefaults"
});

export const CONTENT_TYPES = Object.freeze([
  "category",
  "subtype",
  "nameTemplate",
  "ability",
  "aura",
  "affliction",
  "effect",
  "poison",
  "spellProfile",
  "spellPackage",
  "lootProfile"
]);

export const RANKS = Object.freeze({
  ATTRIBUTE: ["extreme", "high", "moderate", "low", "terrible"],
  DEFENSE: ["extreme", "high", "moderate", "low"],
  SAVE: ["extreme", "high", "moderate", "low", "terrible"],
  HP: ["high", "moderate", "low"],
  ATTACK: ["extreme", "high", "moderate", "low"],
  DAMAGE: ["extreme", "high", "moderate", "low"],
  SKILL: ["extreme", "high", "moderate", "low"]
});

export const SKILL_SLUGS = Object.freeze([
  "acrobatics", "arcana", "athletics", "crafting", "deception", "diplomacy",
  "intimidation", "medicine", "nature", "occultism", "performance", "religion",
  "society", "stealth", "survival", "thievery"
]);

export const MOVEMENT_TYPES = Object.freeze(["climb", "swim", "fly", "burrow"]);
export const SENSE_TYPES = Object.freeze(["low-light-vision", "darkvision", "scent"]);

export const SIZES = Object.freeze(["tiny", "sm", "med", "lg", "huge", "grg"]);
