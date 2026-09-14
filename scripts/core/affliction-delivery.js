import { deepClone } from "./clone.js";

const VALID_TRIGGERS = new Set(["manual", "on-use", "on-hit", "on-damage", "failed-save", "critical-failure", "custom"]);
const VALID_APPLICATIONS = new Set(["manual", "prompt", "automatic"]);

function text(value) { return String(value ?? "").trim(); }
function lower(value) { return text(value).toLowerCase(); }
function list(value) { return Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean) : []; }

function inferredProfile(resource = {}) {
  const definition = resource.definition ?? {};
  const type = lower(definition.afflictionType || "disease");
  const explicit = resource.deliveryProfile && typeof resource.deliveryProfile === "object" ? resource.deliveryProfile : {};
  const injuryPoison = definition.delivery?.injuryPoison === true;
  if (Object.keys(explicit).length) return { ...deepClone(explicit), injuryPoison };
  if (injuryPoison) return {
    hostOrder: ["attack"], trigger: "on-damage", application: "automatic",
    preferredDamageTypes: ["piercing", "slashing"], injuryPoison: true, charges: 1, fallback: "manual"
  };
  if (type === "poison") return {
    hostOrder: ["attack", "ability"], trigger: "on-damage", application: "automatic",
    preferredDamageTypes: ["piercing", "slashing"], preferredAttackNames: ["bite", "jaws", "fang", "sting", "stinger", "claw", "maw"],
    preferredAbilityTags: ["poison", "venom", "strike"], fallback: "manual"
  };
  if (type === "disease") return {
    hostOrder: ["ability", "attack"], trigger: "on-hit", application: "automatic",
    preferredDamageTypes: ["piercing", "slashing"], preferredAttackNames: ["bite", "jaws", "claw", "maw", "spore"],
    preferredAbilityTags: ["disease", "spore", "fungus", "strike"], fallback: "manual"
  };
  if (type === "curse") return {
    hostOrder: ["ability", "attack"], trigger: "on-use", application: "prompt",
    preferredAbilityTags: ["curse", "fiend", "unholy", "mental", "control", "fear"], fallback: "manual"
  };
  return { hostOrder: ["ability", "attack"], trigger: "on-use", application: "prompt", fallback: "manual" };
}

function attackConceptHints(profile) {
  return [
    ...list(profile.preferredDamageTypes),
    ...list(profile.preferredAttackNames),
    ...list(profile.preferredAttackTraits),
    ...list(profile.requiredAttackTraits)
  ];
}

function abilityConceptHints(profile) {
  return [
    ...list(profile.preferredAbilityTags),
    ...list(profile.requiredAbilityTags)
  ];
}

function hasConceptHints(profile) {
  return attackConceptHints(profile).length > 0 || abilityConceptHints(profile).length > 0;
}

function scoreAttack(attack, profile) {
  if (!attack) return -1;

  const attackHints = attackConceptHints(profile);
  if (hasConceptHints(profile) && attackHints.length === 0) return -1;

  const traits = new Set((attack.traits ?? []).map(lower));
  for (const trait of list(profile.requiredAttackTraits).map(lower)) if (!traits.has(trait)) return -1;

  const damageType = lower(attack.damage?.type);
  const attackName = lower(attack.name);
  const preferredDamageTypes = list(profile.preferredDamageTypes).map(lower);
  const preferredAttackNames = list(profile.preferredAttackNames).map(lower);
  const preferredAttackTraits = list(profile.preferredAttackTraits).map(lower);
  const hasPreferredCriteria = preferredDamageTypes.length > 0 || preferredAttackNames.length > 0 || preferredAttackTraits.length > 0;
  const preferredMatch = preferredDamageTypes.includes(damageType)
    || preferredAttackNames.some((hint) => hint && attackName.includes(hint))
    || preferredAttackTraits.some((trait) => traits.has(trait));
  if (hasPreferredCriteria && !preferredMatch) return -1;

  let score = attack.kind === "melee" ? 20 : 5;
  if (preferredDamageTypes.includes(damageType)) score += 40;
  for (const hint of preferredAttackNames) if (hint && attackName.includes(hint)) score += 55;
  for (const trait of preferredAttackTraits) if (traits.has(trait)) score += 15;
  if (attack.profile === "accurate") score += 3;
  return score;
}

function scoreAbility(ability, profile) {
  if (!ability) return -1;
  if (lower(profile.trigger) === "on-use" && lower(ability.type) === "passive") return -1;

  const abilityHints = abilityConceptHints(profile);
  if (hasConceptHints(profile) && abilityHints.length === 0) return -1;

  const tags = new Set([...(ability.tags ?? []), ...(ability.traits ?? [])].map(lower));
  const requiredTags = list(profile.requiredAbilityTags).map(lower);
  for (const tag of requiredTags) if (!tags.has(tag)) return -1;

  const preferredTags = list(profile.preferredAbilityTags).map(lower);
  if (preferredTags.length > 0 && !preferredTags.some((tag) => tags.has(tag))) return -1;

  let score = 10;
  for (const tag of preferredTags) if (tags.has(tag)) score += 35;
  if (lower(ability.type) === "passive") score -= 8;
  return score;
}

function bestHost(blueprint, profile) {
  const hostOrder = list(profile.hostOrder).length ? list(profile.hostOrder) : ["ability", "attack"];
  for (const hostType of hostOrder) {
    if (hostType === "attack") {
      const ranked = (blueprint.combat?.attacks ?? []).map((host) => ({ host, score: scoreAttack(host, profile) })).filter((entry) => entry.score >= 0).sort((a, b) => b.score - a.score);
      if (ranked[0]?.host) return { hostType: "attack", hostId: ranked[0].host.id, score: ranked[0].score };
    }
    if (hostType === "ability") {
      const ranked = (blueprint.abilities ?? []).map((host) => ({ host, score: scoreAbility(host, profile) })).filter((entry) => entry.score >= 0).sort((a, b) => b.score - a.score);
      if (ranked[0]?.host) return { hostType: "ability", hostId: ranked[0].host.id, score: ranked[0].score };
    }
  }
  return null;
}

export function resolveAfflictionDelivery(resource, blueprint) {
  const profile = inferredProfile(resource);
  if (profile.host === "manual" || profile.mode === "manual") return { mode: "manual", trigger: "manual", application: "manual", reason: "explicit-manual" };
  const host = bestHost(blueprint, profile);
  if (!host) return { mode: "manual", trigger: "manual", application: "manual", reason: "no-compatible-host" };
  const trigger = VALID_TRIGGERS.has(profile.trigger) ? profile.trigger : (host.hostType === "attack" ? "on-hit" : "on-use");
  const application = VALID_APPLICATIONS.has(profile.application) ? profile.application : "prompt";
  return {
    mode: "hosted",
    hostType: host.hostType,
    hostId: host.hostId,
    trigger,
    application,
    injuryPoison: profile.injuryPoison === true,
    charges: profile.injuryPoison === true ? Math.max(1, Number(profile.charges ?? 1)) : null,
    score: host.score,
    reason: "concept-match"
  };
}

export function assignAfflictionDeliveries(blueprint) {
  if (!blueprint?.resources?.afflictions) return blueprint;
  for (const resource of blueprint.resources.afflictions) resource.delivery = resolveAfflictionDelivery(resource, blueprint);
  return blueprint;
}
