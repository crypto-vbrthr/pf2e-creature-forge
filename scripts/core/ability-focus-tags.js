// Curated, human-facing suggestions. The generator still accepts arbitrary tags
// from independently registered Creature Forge add-ons.
export const ABILITY_FOCUS_GROUPS = Object.freeze([
  Object.freeze({ id: "tactics", tags: Object.freeze(["control", "movement", "reaction", "defense", "area", "terrain", "forced-movement", "ensnarement", "zones", "battlefield-control"]) }),
  Object.freeze({ id: "style", tags: Object.freeze(["strike", "melee", "ranged", "teamwork", "support", "tactical", "predator"]) }),
  Object.freeze({ id: "themes", tags: Object.freeze(["fear", "energy", "fire", "cold", "poison", "magic"]) })
]);

export const COMMON_ABILITY_FOCUS_TAGS = Object.freeze(ABILITY_FOCUS_GROUPS.flatMap((group) => group.tags));
const commonTagSet = new Set(COMMON_ABILITY_FOCUS_TAGS);

export function normalizeAbilityFocus(tags = []) {
  return [...new Set(tags.map((tag) => String(tag ?? "").trim().toLowerCase()).filter(Boolean))];
}

export function additionalAbilityFocus(tags = []) {
  return normalizeAbilityFocus(tags).filter((tag) => !commonTagSet.has(tag));
}
