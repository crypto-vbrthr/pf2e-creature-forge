export const MODULE_ID = "pf2e-creature-forge";
export const MODULE_VERSION = "0.1.0";
export const API_VERSION = "0.1.0";
export const REQUEST_SCHEMA_VERSION = 1;
export const BLUEPRINT_SCHEMA_VERSION = 1;
export const CONTENT_SCHEMA_VERSION = 1;

export const SETTINGS = Object.freeze({
  WINDOW_STATE: "windowState"
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
  DEFENSE: ["extreme", "high", "moderate", "low"],
  SAVE: ["extreme", "high", "moderate", "low", "terrible"],
  HP: ["high", "moderate", "low"]
});

export const SIZES = Object.freeze(["tiny", "sm", "med", "lg", "huge", "grg"]);
