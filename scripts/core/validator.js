import { RANKS, SIZES } from "../constants.js";
import { ROLE_IDS } from "./role-presets.js";

function issue(level, code, path, message) {
  return { level, code, path, message };
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

  const ac = request?.defenses?.ac;
  if (ac !== "role" && !RANKS.DEFENSE.includes(ac)) issues.push(issue("error", "INVALID_AC_RANK", "defenses.ac", `Invalid AC rank '${ac}'.`));
  const hp = request?.defenses?.hp;
  if (hp !== "role" && !RANKS.HP.includes(hp)) issues.push(issue("error", "INVALID_HP_RANK", "defenses.hp", `Invalid HP rank '${hp}'.`));
  const perception = request?.defenses?.perception;
  if (perception !== "role" && !RANKS.SAVE.includes(perception)) issues.push(issue("error", "INVALID_PERCEPTION_RANK", "defenses.perception", `Invalid Perception rank '${perception}'.`));
  for (const save of ["fortitude", "reflex", "will"]) {
    const rank = request?.defenses?.saves?.[save];
    if (rank !== "role" && !RANKS.SAVE.includes(rank)) issues.push(issue("error", "INVALID_SAVE_RANK", `defenses.saves.${save}`, `Invalid ${save} rank '${rank}'.`));
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
  return {
    valid: !issues.some((entry) => entry.level === "error"),
    errors: issues.filter((entry) => entry.level === "error"),
    warnings: issues.filter((entry) => entry.level === "warning"),
    issues
  };
}
