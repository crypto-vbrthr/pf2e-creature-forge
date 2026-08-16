import { RANKS, SIZES } from "../constants.js";
import { ROLE_IDS } from "./role-presets.js";

const ABILITIES = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);
const ATTACK_KINDS = Object.freeze(["role", "melee", "ranged"]);

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
    const exists = registry.list("category").some((entry) => entry.slug === category || entry.id === category);
    if (!exists) issues.push(issue("warning", "CATEGORY_UNREGISTERED", "identity.category", `Category '${category}' is not registered.`));
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
