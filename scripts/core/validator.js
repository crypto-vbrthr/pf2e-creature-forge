import { MOVEMENT_TYPES, RANKS, SENSE_TYPES, SIZES, SKILL_SLUGS } from "../constants.js";
import { ROLE_IDS } from "./role-presets.js";

const ABILITIES = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);
const ATTACK_KINDS = Object.freeze(["role", "melee", "ranged"]);
const SPEED_TOKENS = Object.freeze(["role", "auto", "none", "off"]);
const SENSE_TOKENS = Object.freeze(["auto", "on", "off", true, false]);
const AFFINITY_MODES = Object.freeze(["auto", "off"]);
const HP_COMPENSATION_MODES = Object.freeze(["auto", "off"]);

function issue(level, code, path, message) {
  return { level, code, path, message };
}

function validateRank(issues, value, allowed, path, code, label, { allowRole = true } = {}) {
  if (allowRole && value === "role") return;
  if (!allowed.includes(value)) issues.push(issue("error", code, path, `Invalid ${label} rank '${value}'.`));
}

export function validateGenerationRequest(request, { registry } = {}) {
  const issues = [];
  const level = Number(request?.identity?.level);
  if (!Number.isInteger(level) || level < -1 || level > 24) {
    issues.push(issue("error", "LEVEL_OUT_OF_RANGE", "identity.level", "Level must be an integer from -1 to 24."));
  }
  if (!ROLE_IDS.includes(request?.identity?.role)) {
    issues.push(issue("error", "UNKNOWN_ROLE", "identity.role", `Unknown role '${request?.identity?.role}'.`));
  }
  if (!SIZES.includes(request?.identity?.size)) {
    issues.push(issue("error", "UNKNOWN_SIZE", "identity.size", `Unknown size '${request?.identity?.size}'.`));
  }
  const category = request?.identity?.category;
  if (!category) {
    issues.push(issue("error", "CATEGORY_REQUIRED", "identity.category", "A primary creature category is required."));
  } else if (registry) {
    const exists = Boolean(registry.resolve?.("category", category, { compendiumIds: request?.sources?.categories ?? [] }))
      || registry.list("category").some((entry) => entry.source?.sourceKind !== "compendium" && (entry.slug === category || entry.id === category));
    if (!exists) issues.push(issue("warning", "CATEGORY_UNREGISTERED", "identity.category", `Category '${category}' is not registered.`));
  }
  if (registry) {
    for (const subtype of request?.identity?.subtypes ?? []) {
      const definition = registry.resolve?.("subtype", subtype, { compendiumIds: request?.sources?.subtypes ?? [] })
        ?? registry.list("subtype").find((entry) => entry.source?.sourceKind !== "compendium" && (entry.slug === subtype || entry.id === subtype));
      if (!definition) {
        issues.push(issue("warning", "SUBTYPE_UNREGISTERED", "identity.subtypes", `Subtype '${subtype}' is not registered.`));
        continue;
      }
      const supportedCategories = definition.supports?.categories ?? definition.selection?.categories ?? [];
      if (supportedCategories.length && category && !supportedCategories.includes(category)) {
        issues.push(issue("warning", "INCOMPATIBLE_SUBTYPE", "identity.subtypes", `Subtype '${definition.slug ?? subtype}' is not normally compatible with category '${category}'.`));
      }
    }
  }

  if (!AFFINITY_MODES.includes(request?.defensiveAffinities?.mode)) {
    issues.push(issue("error", "INVALID_AFFINITY_MODE", "defensiveAffinities.mode", "Defensive affinity mode must be auto or off."));
  }
  if (!HP_COMPENSATION_MODES.includes(request?.defensiveAffinities?.hpCompensation)) {
    issues.push(issue("error", "INVALID_HP_COMPENSATION_MODE", "defensiveAffinities.hpCompensation", "Affinity HP compensation must be auto or off."));
  }
  for (const [kind, entries] of Object.entries({
    immunities: request?.defensiveAffinities?.immunities ?? [],
    resistances: request?.defensiveAffinities?.resistances ?? [],
    weaknesses: request?.defensiveAffinities?.weaknesses ?? []
  })) {
    entries.forEach((entry, index) => {
      if (!String(entry?.type ?? "").trim()) issues.push(issue("error", "INVALID_AFFINITY_TYPE", `defensiveAffinities.${kind}.${index}`, "Defensive affinity entries require a type."));
      if (kind !== "immunities" && entry?.value !== undefined && (!Number.isFinite(Number(entry.value)) || Number(entry.value) <= 0)) {
        issues.push(issue("error", "INVALID_AFFINITY_VALUE", `defensiveAffinities.${kind}.${index}.value`, "Resistance and weakness values must be positive numbers when specified."));
      }
    });
  }

  for (const ability of ABILITIES) {
    validateRank(issues, request?.attributes?.[ability], RANKS.ATTRIBUTE, `attributes.${ability}`, "INVALID_ATTRIBUTE_RANK", ability.toUpperCase());
  }
  validateRank(issues, request?.defenses?.ac, RANKS.DEFENSE, "defenses.ac", "INVALID_AC_RANK", "AC");
  validateRank(issues, request?.defenses?.hp, RANKS.HP, "defenses.hp", "INVALID_HP_RANK", "HP");
  validateRank(issues, request?.defenses?.perception, RANKS.SAVE, "defenses.perception", "INVALID_PERCEPTION_RANK", "Perception");
  for (const save of ["fortitude", "reflex", "will"]) {
    validateRank(issues, request?.defenses?.saves?.[save], RANKS.SAVE, `defenses.saves.${save}`, "INVALID_SAVE_RANK", save);
  }
  validateRank(issues, request?.offense?.attack, RANKS.ATTACK, "offense.attack", "INVALID_ATTACK_RANK", "attack");
  validateRank(issues, request?.offense?.damage, RANKS.DAMAGE, "offense.damage", "INVALID_DAMAGE_RANK", "damage");
  if (!ATTACK_KINDS.includes(request?.offense?.kind)) {
    issues.push(issue("error", "INVALID_ATTACK_KIND", "offense.kind", `Invalid attack kind '${request?.offense?.kind}'.`));
  }
  const attackCount = Number(request?.options?.attackCount);
  if (!Number.isInteger(attackCount) || attackCount < 0 || attackCount > 2) {
    issues.push(issue("error", "INVALID_ATTACK_COUNT", "options.attackCount", "Attack count must be 0, 1, or 2."));
  }

  const skillCount = request?.skills?.count;
  if (skillCount !== "role" && (!Number.isInteger(Number(skillCount)) || Number(skillCount) < 0 || Number(skillCount) > 8)) {
    issues.push(issue("error", "INVALID_SKILL_COUNT", "skills.count", "Skill count must be 'role' or an integer from 0 to 8."));
  }
  validateRank(issues, request?.skills?.primaryRank, RANKS.SKILL, "skills.primaryRank", "INVALID_SKILL_RANK", "skill", { allowRole: true });
  for (const slug of request?.skills?.preferred ?? []) {
    if (!SKILL_SLUGS.includes(slug)) issues.push(issue("warning", "UNKNOWN_PREFERRED_SKILL", "skills.preferred", `Unknown preferred skill '${slug}'.`));
  }

  const validateSpeed = (value, path, { allowRole = false } = {}) => {
    if ((allowRole && value === "role") || ["auto", "none", "off"].includes(value)) return;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 200) issues.push(issue("error", "INVALID_SPEED", path, `Speed '${value}' must be a supported token or a number from 0 to 200.`));
  };
  validateSpeed(request?.movement?.land, "movement.land", { allowRole: true });
  for (const type of MOVEMENT_TYPES) validateSpeed(request?.movement?.[type], `movement.${type}`);

  for (const [key, value] of [["lowLightVision", request?.senses?.lowLightVision], ["darkvision", request?.senses?.darkvision], ["scent", request?.senses?.scent]]) {
    if (!SENSE_TOKENS.includes(value)) issues.push(issue("error", "INVALID_SENSE_SETTING", `senses.${key}`, `Sense setting '${value}' must be auto, on, or off.`));
  }
  const scentRange = Number(request?.senses?.scentRange);
  if (!Number.isFinite(scentRange) || scentRange < 5 || scentRange > 300) issues.push(issue("error", "INVALID_SENSE_RANGE", "senses.scentRange", "Scent range must be from 5 to 300 feet."));

  if (request?.identity?.size === "lg" && level < 1) {
    issues.push(issue("warning", "UNUSUAL_SIZE_FOR_LEVEL", "identity.size", "Large creatures are unusual below level 1."));
  }
  if (request?.identity?.size === "huge" && level < 5) {
    issues.push(issue("warning", "UNUSUAL_SIZE_FOR_LEVEL", "identity.size", "Huge creatures are unusual below level 5."));
  }
  if (request?.identity?.size === "grg" && level < 10) {
    issues.push(issue("warning", "UNUSUAL_SIZE_FOR_LEVEL", "identity.size", "Gargantuan creatures are unusual below level 10."));
  }

  return {
    valid: !issues.some((entry) => entry.level === "error"),
    errors: issues.filter((entry) => entry.level === "error"),
    warnings: issues.filter((entry) => entry.level === "warning"),
    issues
  };
}

export function validateBlueprint(blueprint) {
  const issues = [];
  const saves = Object.values(blueprint?.statistics?.saves ?? {});
  const extremeSaves = saves.filter((entry) => entry?.rank === "extreme").length;
  if (extremeSaves > 1) {
    issues.push(issue("warning", "MULTIPLE_EXTREME_SAVES", "statistics.saves", "Most creatures should not have more than one extreme saving throw."));
  }
  if (blueprint?.statistics?.ac?.rank === "extreme" && blueprint?.statistics?.hp?.rank === "high") {
    issues.push(issue("warning", "EXTREME_AC_HIGH_HP", "statistics", "Extreme AC together with high HP may need compensation elsewhere."));
  }
  if (!blueprint?.identity?.category) {
    issues.push(issue("error", "CATEGORY_REQUIRED", "identity.category", "A primary creature category is required."));
  }

  const affinityGroups = {
    immunities: blueprint?.defenses?.immunities ?? [],
    resistances: blueprint?.defenses?.resistances ?? [],
    weaknesses: blueprint?.defenses?.weaknesses ?? []
  };
  for (const [kind, entries] of Object.entries(affinityGroups)) {
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (!String(entry?.type ?? "").trim()) {
        issues.push(issue("error", "INVALID_AFFINITY_TYPE", `defenses.${kind}.${index}`, "Defensive affinity entries require a type."));
      }
      if (kind !== "immunities" && (!Number.isFinite(Number(entry?.value)) || Number(entry.value) <= 0)) {
        issues.push(issue("error", "INVALID_AFFINITY_VALUE", `defenses.${kind}.${index}`, "Resistance and weakness entries require a positive value."));
      }
    }
  }
  const immunityTypes = new Set(affinityGroups.immunities.map((entry) => entry.type));
  for (const kind of ["resistances", "weaknesses"]) {
    for (const entry of affinityGroups[kind]) {
      if (immunityTypes.has(entry.type)) {
        issues.push(issue("warning", "IWR_CONFLICT", `defenses.${kind}`, `Immunity and ${kind === "resistances" ? "resistance" : "weakness"} both exist for '${entry.type}'.`));
      }
    }
  }
  if (affinityGroups.weaknesses.length > 1) {
    issues.push(issue("warning", "MULTIPLE_WEAKNESSES", "defenses.weaknesses", "Most creatures should normally have no more than one weakness unless the concept specifically calls for more."));
  }
  const broadResistance = affinityGroups.resistances.some((entry) => ["all-damage", "physical"].includes(entry.type));
  if (broadResistance && Number(blueprint?.defenses?.hpAdjustment?.value ?? 0) >= 0) {
    issues.push(issue("warning", "BROAD_RESISTANCE_WITHOUT_HP_TRADEOFF", "defenses.hpAdjustment", "Broad resistance usually warrants lower HP or another defensive tradeoff."));
  }

  for (const ability of ABILITIES) {
    const stat = blueprint?.statistics?.abilities?.[ability];
    if (!stat || !Number.isFinite(Number(stat.value))) {
      issues.push(issue("error", "INVALID_ABILITY_VALUE", `statistics.abilities.${ability}`, `${ability.toUpperCase()} must have a numeric modifier.`));
    }
  }

  const attacks = blueprint?.combat?.attacks ?? [];
  for (let index = 0; index < attacks.length; index += 1) {
    const attack = attacks[index];
    const path = `combat.attacks.${index}`;
    if (!RANKS.ATTACK.includes(attack?.attack?.rank) || !Number.isFinite(Number(attack?.attack?.value))) {
      issues.push(issue("error", "INVALID_ATTACK", path, `Attack '${attack?.name ?? index + 1}' has an invalid attack rank or bonus.`));
    }
    if (!RANKS.DAMAGE.includes(attack?.damage?.rank) || !String(attack?.damage?.formula ?? "").trim()) {
      issues.push(issue("error", "INVALID_ATTACK_DAMAGE", path, `Attack '${attack?.name ?? index + 1}' has invalid damage.`));
    }
    if (attack?.attack?.rank === "extreme" && attack?.damage?.rank === "extreme") {
      issues.push(issue("warning", "COUPLED_EXTREME_ATTACK_DAMAGE", path, `Attack '${attack?.name ?? index + 1}' combines extreme accuracy and extreme damage.`));
    }
  }

  if (attacks.length === 2) {
    const [first, second] = attacks;
    const accuracyDiff = Number(first?.attack?.value) - Number(second?.attack?.value);
    const damageDiff = Number(first?.damage?.average) - Number(second?.damage?.average);
    if (!(accuracyDiff > 0 && damageDiff < 0)) {
      issues.push(issue("warning", "ATTACK_PAIR_NOT_COMPLEMENTARY", "combat.attacks", "Two-attack profiles should normally trade higher accuracy for lower damage and vice versa."));
    }
  }

  const skills = Object.values(blueprint?.statistics?.skills ?? {});
  const highSkills = skills.filter((entry) => entry?.rank === "high").length;
  const extremeSkills = skills.filter((entry) => entry?.rank === "extreme").length;
  if (highSkills > 3) issues.push(issue("warning", "MANY_HIGH_SKILLS", "statistics.skills", "Most creatures should not have more than three high skills."));
  if (extremeSkills > 1) issues.push(issue("warning", "MANY_EXTREME_SKILLS", "statistics.skills", "Most creatures should have at most one extreme skill."));
  for (const skill of skills) {
    if (!SKILL_SLUGS.includes(skill?.slug) || !RANKS.SKILL.includes(skill?.rank) || !Number.isFinite(Number(skill?.value))) {
      issues.push(issue("error", "INVALID_SKILL", "statistics.skills", `Skill '${skill?.slug ?? "unknown"}' has invalid data.`));
    }
  }

  const landSpeed = Number(blueprint?.statistics?.speed?.land);
  if (!Number.isFinite(landSpeed) || landSpeed < 0) issues.push(issue("error", "INVALID_LAND_SPEED", "statistics.speed.land", "Land Speed must be zero or greater."));
  for (const speed of blueprint?.statistics?.speed?.other ?? []) {
    if (!MOVEMENT_TYPES.includes(speed?.type) || !Number.isFinite(Number(speed?.value)) || Number(speed.value) <= 0) {
      issues.push(issue("error", "INVALID_OTHER_SPEED", "statistics.speed.other", `Movement entry '${speed?.type ?? "unknown"}' is invalid.`));
    }
  }

  const senseTypes = [];
  for (const sense of blueprint?.statistics?.senses ?? []) {
    if (!SENSE_TYPES.includes(sense?.type)) issues.push(issue("error", "INVALID_SENSE", "statistics.senses", `Sense '${sense?.type ?? "unknown"}' is invalid.`));
    if (senseTypes.includes(sense?.type)) issues.push(issue("warning", "DUPLICATE_SENSE", "statistics.senses", `Sense '${sense.type}' is duplicated.`));
    senseTypes.push(sense?.type);
    if (sense?.type === "scent" && (!Number.isFinite(Number(sense?.range)) || Number(sense.range) <= 0)) issues.push(issue("error", "INVALID_SENSE_RANGE", "statistics.senses", "Scent requires a positive range."));
  }
  if (senseTypes.includes("darkvision") && senseTypes.includes("low-light-vision")) {
    issues.push(issue("warning", "REDUNDANT_LOW_LIGHT_VISION", "statistics.senses", "Darkvision already covers low-light vision for most stat blocks."));
  }

  const extremeStats = [
    blueprint?.statistics?.ac,
    blueprint?.statistics?.perception,
    ...saves,
    ...Object.values(blueprint?.statistics?.abilities ?? {})
  ].filter((entry) => entry?.rank === "extreme").length;
  const level = Number(blueprint?.identity?.level ?? 0);
  if (level < 11 && extremeStats > 1) {
    issues.push(issue("warning", "MANY_EXTREME_STATS_LOW_LEVEL", "statistics", "Multiple extreme statistics are unusual below level 11."));
  }

  return {
    valid: !issues.some((entry) => entry.level === "error"),
    errors: issues.filter((entry) => entry.level === "error"),
    warnings: issues.filter((entry) => entry.level === "warning"),
    issues
  };
}
