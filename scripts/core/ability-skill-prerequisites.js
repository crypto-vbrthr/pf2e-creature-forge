import { SKILL_SLUGS } from "../constants.js";
import { resolveSkillValue } from "./tables.js";
import { SKILL_DEFINITIONS } from "./skills.js";

const knownSkills = new Set(SKILL_SLUGS);

export function getAbilityRequiredSkills(abilities = []) {
  const required = new Set();
  for (const ability of abilities ?? []) {
    const declared = ability?.requirements?.skills ?? [];
    const interactionSkills = (ability?.interactions ?? [])
      .filter((entry) => entry?.kind === "check")
      .map((entry) => entry.statistic);
    const candidates = [...(Array.isArray(declared) ? declared : []), ...(ability?.tags ?? []), ...interactionSkills];
    for (const skill of candidates) {
      const slug = typeof skill === "string" ? skill : skill?.slug;
      if (knownSkills.has(slug)) required.add(slug);
    }
  }
  return [...required];
}

// A skill-check ability must have an actual skill modifier, not merely an
// attribute score that the GM has to improvise. This is additive, because
// explicitly configured or locked creature skills must never be discarded.
export function ensureAbilityRequiredSkills(skills = {}, abilities = [], level = 0, random) {
  const updated = { ...(skills ?? {}) };
  for (const slug of getAbilityRequiredSkills(abilities)) {
    if (updated[slug]) continue;
    updated[slug] = {
      slug,
      attribute: SKILL_DEFINITIONS[slug].attribute,
      rank: "moderate",
      value: resolveSkillValue(level, "moderate", random?.fork?.(`required-skill:${slug}`)),
      special: [],
      locked: false,
      generatedForAbility: true
    };
  }
  return updated;
}
