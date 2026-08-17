import { BLUEPRINT_SCHEMA_VERSION, MOVEMENT_TYPES, RANKS, SENSE_TYPES, SIZES, SKILL_SLUGS } from "../constants.js";
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

  if (!["auto", "off"].includes(request?.abilities?.mode)) {
    issues.push(issue("error", "INVALID_ABILITY_MODE", "abilities.mode", "Ability generation mode must be auto or off."));
  }
  const abilityCount = request?.abilities?.count;
  if (abilityCount !== "role" && (!Number.isInteger(Number(abilityCount)) || Number(abilityCount) < 0 || Number(abilityCount) > 5)) {
    issues.push(issue("error", "INVALID_ABILITY_COUNT", "abilities.count", "Ability count must be 'role' or an integer from 0 to 5."));
  }
  if (!["simple", "standard", "complex"].includes(request?.abilities?.complexity)) {
    issues.push(issue("error", "INVALID_ABILITY_COMPLEXITY", "abilities.complexity", "Ability complexity must be simple, standard, or complex."));
  }
  const powerBudget = request?.abilities?.powerBudget;
  if (powerBudget !== "auto" && (!Number.isInteger(Number(powerBudget)) || Number(powerBudget) < 0 || Number(powerBudget) > 30)) {
    issues.push(issue("error", "INVALID_ABILITY_POWER_BUDGET", "abilities.powerBudget", "Ability power budget must be 'auto' or an integer from 0 to 30."));
  }
  if (registry) {
    for (const libraryId of request?.sources?.abilities ?? []) {
      if (!registry.getAbilityLibrary?.(libraryId)) {
        issues.push(issue("warning", "UNKNOWN_ABILITY_LIBRARY", "sources.abilities", `Ability library '${libraryId}' is not registered.`));
      }
    }
  }

  if (!["rare", "normal", "high"].includes(request?.specialFeatures?.frequency)) {
    issues.push(issue("error", "INVALID_SPECIAL_FEATURE_FREQUENCY", "specialFeatures.frequency", "Special feature frequency must be rare, normal, or high."));
  }
  for (const [kind, value] of [["auras", request?.specialFeatures?.auras?.mode], ["afflictions", request?.specialFeatures?.afflictions?.mode]]) {
    if (!["auto", "none", "required"].includes(value)) {
      issues.push(issue("error", "INVALID_SPECIAL_FEATURE_MODE", `specialFeatures.${kind}.mode`, `${kind} mode must be auto, none, or required.`));
    }
  }
  const spellcasting = request?.spellcasting ?? {};
  if (!["auto", "none", "required"].includes(spellcasting.mode)) issues.push(issue("error", "INVALID_SPELLCASTING_MODE", "spellcasting.mode", "Spellcasting mode must be auto, none, or required."));
  if (!["auto", "innate", "prepared", "spontaneous"].includes(spellcasting.style)) issues.push(issue("error", "INVALID_SPELLCASTING_STYLE", "spellcasting.style", "Spellcasting style must be auto, innate, prepared, or spontaneous."));
  if (!["auto", "arcane", "divine", "occult", "primal"].includes(spellcasting.tradition)) issues.push(issue("error", "INVALID_SPELL_TRADITION", "spellcasting.tradition", "Spell tradition must be auto, arcane, divine, occult, or primal."));
  if (!["role", "moderate", "high", "extreme"].includes(spellcasting.dcRank)) issues.push(issue("error", "INVALID_SPELL_DC_RANK", "spellcasting.dcRank", "Spell DC rank must be role, moderate, high, or extreme."));
  if (spellcasting.highestRank !== "auto" && (!Number.isInteger(Number(spellcasting.highestRank)) || Number(spellcasting.highestRank) < 1 || Number(spellcasting.highestRank) > 10)) issues.push(issue("error", "INVALID_HIGHEST_SPELL_RANK", "spellcasting.highestRank", "Highest spell rank must be auto or an integer from 1 to 10."));
  if (!["focused", "standard", "broad"].includes(spellcasting.breadth)) issues.push(issue("error", "INVALID_SPELL_BREADTH", "spellcasting.breadth", "Spell breadth must be focused, standard, or broad."));

  if (registry) {
    for (const libraryId of request?.sources?.auras ?? []) {
      if (!registry.getAuraLibrary?.(libraryId)) issues.push(issue("warning", "UNKNOWN_AURA_LIBRARY", "sources.auras", `Aura library '${libraryId}' is not registered.`));
    }
    for (const libraryId of request?.sources?.afflictions ?? []) {
      if (!registry.getAfflictionLibrary?.(libraryId)) issues.push(issue("warning", "UNKNOWN_AFFLICTION_LIBRARY", "sources.afflictions", `Affliction library '${libraryId}' is not registered.`));
    }
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
  const schemaVersion = Number(blueprint?.schemaVersion);
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    issues.push(issue("error", "INVALID_BLUEPRINT_SCHEMA_VERSION", "schemaVersion", "CreatureBlueprint requires a positive schema version."));
  } else if (schemaVersion > BLUEPRINT_SCHEMA_VERSION) {
    issues.push(issue("error", "BLUEPRINT_SCHEMA_TOO_NEW", "schemaVersion", `CreatureBlueprint schema ${schemaVersion} is newer than supported schema ${BLUEPRINT_SCHEMA_VERSION}.`));
  }
  const blueprintLevel = Number(blueprint?.identity?.level);
  if (!Number.isInteger(blueprintLevel) || blueprintLevel < -1 || blueprintLevel > 24) {
    issues.push(issue("error", "BLUEPRINT_LEVEL_OUT_OF_RANGE", "identity.level", "CreatureBlueprint level must be an integer from -1 to 24."));
  }
  if (!SIZES.includes(blueprint?.identity?.size)) {
    issues.push(issue("error", "INVALID_BLUEPRINT_SIZE", "identity.size", `CreatureBlueprint has unsupported size '${blueprint?.identity?.size}'.`));
  }
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

  const spellcastingIds = new Set();
  for (const [entryIndex, entry] of (blueprint?.combat?.spellcasting ?? []).entries()) {
    const path = `combat.spellcasting.${entryIndex}`;
    const entryId = String(entry?.id ?? "").trim();
    if (!entryId) issues.push(issue("error", "SPELLCASTING_ID_REQUIRED", `${path}.id`, "Spellcasting entries require a stable id."));
    else if (spellcastingIds.has(entryId)) issues.push(issue("error", "DUPLICATE_SPELLCASTING_ID", `${path}.id`, `Spellcasting id '${entryId}' is duplicated.`));
    else spellcastingIds.add(entryId);
    if (!["arcane", "divine", "occult", "primal"].includes(entry?.tradition)) issues.push(issue("error", "INVALID_BLUEPRINT_SPELL_TRADITION", `${path}.tradition`, "Spellcasting entry has an invalid tradition."));
    if (!["innate", "prepared", "spontaneous"].includes(entry?.style)) issues.push(issue("error", "INVALID_BLUEPRINT_SPELL_STYLE", `${path}.style`, "Spellcasting entry has an invalid style."));
    if (!Number.isFinite(Number(entry?.dc)) || !Number.isFinite(Number(entry?.attack))) issues.push(issue("error", "INVALID_BLUEPRINT_SPELL_DC", path, "Spellcasting entry requires numeric spell DC and spell attack modifier."));
    if (!Number.isInteger(Number(entry?.highestRank)) || Number(entry.highestRank) < 1 || Number(entry.highestRank) > 10) issues.push(issue("error", "INVALID_BLUEPRINT_HIGHEST_SPELL_RANK", `${path}.highestRank`, "Highest spell rank must be from 1 to 10."));
    const spellIds = new Set();
    for (const [spellIndex, spell] of (entry?.spells ?? []).entries()) {
      const spellPath = `${path}.spells.${spellIndex}`;
      const spellId = String(spell?.id ?? "").trim();
      if (!spellId) issues.push(issue("error", "SPELL_ID_REQUIRED", `${spellPath}.id`, "Generated spells require a stable id."));
      else if (spellIds.has(spellId)) issues.push(issue("error", "DUPLICATE_SPELL_ID", `${spellPath}.id`, `Spell id '${spellId}' is duplicated within the spellcasting entry.`));
      else spellIds.add(spellId);
      if (!String(spell?.sourceUuid ?? "").trim()) issues.push(issue("error", "SPELL_SOURCE_UUID_REQUIRED", `${spellPath}.sourceUuid`, "Generated spells require a source UUID."));
      if (!spell?.cantrip && (!Number.isInteger(Number(spell?.rank)) || Number(spell.rank) < Number(spell?.baseRank ?? 1) || Number(spell.rank) > Number(entry.highestRank))) issues.push(issue("error", "INVALID_GENERATED_SPELL_RANK", `${path}.spells.${spellIndex}.rank`, "Generated spell rank must be between the spell's base rank and the entry's highest rank."));
    }
  }

  const attacks = blueprint?.combat?.attacks ?? [];
  const attackIds = new Set();
  for (let index = 0; index < attacks.length; index += 1) {
    const attack = attacks[index];
    const path = `combat.attacks.${index}`;
    const attackId = String(attack?.id ?? "").trim();
    if (!attackId) issues.push(issue("error", "ATTACK_ID_REQUIRED", `${path}.id`, "Generated attacks require a stable id."));
    else if (attackIds.has(attackId)) issues.push(issue("error", "DUPLICATE_ATTACK_ID", `${path}.id`, `Attack id '${attackId}' is duplicated.`));
    else attackIds.add(attackId);
    if (!["melee", "ranged"].includes(attack?.kind)) issues.push(issue("error", "INVALID_BLUEPRINT_ATTACK_KIND", `${path}.kind`, "Generated attacks must be melee or ranged."));
    if (attack?.kind === "ranged" && (!Number.isFinite(Number(attack?.range)) || Number(attack.range) <= 0)) issues.push(issue("error", "INVALID_BLUEPRINT_ATTACK_RANGE", `${path}.range`, "Ranged attacks require a positive range."));
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

  const generatedAbilities = blueprint?.abilities ?? [];
  const abilityIds = new Set();
  const effectResources = new Map((blueprint?.resources?.effects ?? []).map((resource) => [resource.id, resource]));
  for (let index = 0; index < generatedAbilities.length; index += 1) {
    const ability = generatedAbilities[index];
    const path = `abilities.${index}`;
    if (!String(ability?.id ?? "").trim()) issues.push(issue("error", "ABILITY_ID_REQUIRED", path, "Generated abilities require a stable instance id."));
    if (abilityIds.has(ability?.id)) issues.push(issue("error", "DUPLICATE_ABILITY_ID", path, `Ability id '${ability?.id}' is duplicated.`));
    abilityIds.add(ability?.id);
    if (!String(ability?.contentId ?? "").trim()) issues.push(issue("error", "ABILITY_CONTENT_ID_REQUIRED", path, "Generated abilities require a content id."));
    if (!["action", "reaction", "free", "passive"].includes(ability?.type)) issues.push(issue("error", "INVALID_ABILITY_TYPE", `${path}.type`, `Unsupported ability type '${ability?.type}'.`));
    if (ability?.type === "action" && (!Number.isInteger(Number(ability?.actionCost)) || Number(ability.actionCost) < 1 || Number(ability.actionCost) > 3)) {
      issues.push(issue("error", "INVALID_ABILITY_ACTION_COST", `${path}.actionCost`, "Action abilities require an action cost from 1 to 3."));
    }
    for (const application of ability?.applications ?? []) {
      if (application?.type === "effect") {
        if (!String(application.ref ?? "").trim()) issues.push(issue("error", "EFFECT_REF_REQUIRED", path, "Effect applications require a resource reference."));
        else if (!effectResources.has(application.ref)) issues.push(issue("error", "MISSING_EFFECT_RESOURCE", path, `Ability '${ability.contentId}' references missing effect '${application.ref}'.`));
      }
    }
  }
  const effectResourceIds = new Set();
  for (let index = 0; index < (blueprint?.resources?.effects ?? []).length; index += 1) {
    const resource = blueprint.resources.effects[index];
    const resourceId = String(resource?.id ?? "").trim();
    if (resourceId && effectResourceIds.has(resourceId)) issues.push(issue("error", "DUPLICATE_EFFECT_RESOURCE_ID", `resources.effects.${index}.id`, `Effect resource id '${resourceId}' is duplicated.`));
    if (resourceId) effectResourceIds.add(resourceId);
    const definition = resource?.definition;
    if (!String(resource?.id ?? "").trim()) issues.push(issue("error", "EFFECT_RESOURCE_ID_REQUIRED", `resources.effects.${index}`, "Effect resources require an id."));
    if (!definition || typeof definition !== "object" || !String(definition?.name ?? "").trim() || !Array.isArray(definition?.components) || !definition.components.length) {
      issues.push(issue("error", "INVALID_EFFECT_RESOURCE", `resources.effects.${index}`, "Effect resources require an Effect Forge-compatible definition with a name and components."));
    }
  }

  const auraResourceIds = new Set();
  for (let index = 0; index < (blueprint?.resources?.auras ?? []).length; index += 1) {
    const resource = blueprint.resources.auras[index];
    const resourceId = String(resource?.id ?? "").trim();
    if (resourceId && auraResourceIds.has(resourceId)) issues.push(issue("error", "DUPLICATE_AURA_RESOURCE_ID", `resources.auras.${index}.id`, `Aura resource id '${resourceId}' is duplicated.`));
    if (resourceId) auraResourceIds.add(resourceId);
    const definition = resource?.definition;
    if (!String(resource?.id ?? "").trim()) issues.push(issue("error", "AURA_RESOURCE_ID_REQUIRED", `resources.auras.${index}`, "Aura resources require an id."));
    if (!definition || typeof definition !== "object" || !String(definition?.name ?? "").trim() || !Number.isFinite(Number(definition?.radius)) || Number(definition.radius) <= 0) {
      issues.push(issue("error", "INVALID_AURA_RESOURCE", `resources.auras.${index}`, "Aura resources require an Aura Forge-compatible definition with a name and positive radius."));
    }
  }
  const afflictionResourceIds = new Set();
  for (let index = 0; index < (blueprint?.resources?.afflictions ?? []).length; index += 1) {
    const resource = blueprint.resources.afflictions[index];
    const resourceId = String(resource?.id ?? "").trim();
    if (resourceId && afflictionResourceIds.has(resourceId)) issues.push(issue("error", "DUPLICATE_AFFLICTION_RESOURCE_ID", `resources.afflictions.${index}.id`, `Affliction resource id '${resourceId}' is duplicated.`));
    if (resourceId) afflictionResourceIds.add(resourceId);
    const definition = resource?.definition;
    if (!String(resource?.id ?? "").trim()) issues.push(issue("error", "AFFLICTION_RESOURCE_ID_REQUIRED", `resources.afflictions.${index}`, "Affliction resources require an id."));
    if (!definition || typeof definition !== "object" || !String(definition?.name ?? "").trim() || !Array.isArray(definition?.stages) || !definition.stages.length) {
      issues.push(issue("error", "INVALID_AFFLICTION_RESOURCE", `resources.afflictions.${index}`, "Affliction resources require an Affliction Forge-compatible definition with a name and at least one stage."));
    }
    const delivery = resource?.delivery;
    if (delivery && !["hosted", "manual"].includes(delivery.mode)) issues.push(issue("error", "INVALID_AFFLICTION_DELIVERY", `resources.afflictions.${index}.delivery`, "Affliction delivery mode must be hosted or manual."));
    if (delivery?.mode === "hosted" && (!String(delivery.hostId ?? "").trim() || !["attack", "ability"].includes(delivery.hostType))) {
      issues.push(issue("error", "INVALID_AFFLICTION_DELIVERY_HOST", `resources.afflictions.${index}.delivery`, "Hosted Affliction delivery requires a valid attack or ability host."));
    } else if (delivery?.mode === "hosted") {
      const hostExists = delivery.hostType === "attack"
        ? (blueprint?.combat?.attacks ?? []).some((entry) => entry?.id === delivery.hostId)
        : (blueprint?.abilities ?? []).some((entry) => entry?.id === delivery.hostId);
      if (!hostExists) issues.push(issue("warning", "AFFLICTION_DELIVERY_HOST_MISSING", `resources.afflictions.${index}.delivery`, `Hosted Affliction delivery points to missing ${delivery.hostType} '${delivery.hostId}'. Runtime will fall back to manual application.`));
    }
  }
  if ((blueprint?.resources?.auras ?? []).length > 1) issues.push(issue("warning", "MULTIPLE_GENERATED_AURAS", "resources.auras", "The 0.4.x generator normally creates at most one aura."));
  if ((blueprint?.resources?.afflictions ?? []).length > 1) issues.push(issue("warning", "MULTIPLE_GENERATED_AFFLICTIONS", "resources.afflictions", "The 0.4.x generator normally creates at most one affliction."));
  const abilityBudget = blueprint?.metadata?.abilityBudget ?? null;
  if (abilityBudget) {
    const spent = generatedAbilities.reduce((sum, ability) => sum + Number(ability?.powerCost ?? 0), 0);
    const limit = Number(abilityBudget.limit ?? 0);
    if (Number.isFinite(limit) && spent > limit) {
      issues.push(issue("warning", "ABILITY_POWER_BUDGET_EXCEEDED", "metadata.abilityBudget", `Generated abilities spend ${spent} power against a budget of ${limit}.`));
    }
    if (Number(abilityBudget.spent ?? spent) !== spent) {
      issues.push(issue("warning", "ABILITY_POWER_BUDGET_STALE", "metadata.abilityBudget.spent", "Stored ability power usage does not match the generated abilities."));
    }
  }
  const specialBudget = blueprint?.metadata?.specialFeatureBudget ?? null;
  if (specialBudget) {
    const abilitySpent = generatedAbilities.reduce((sum, ability) => sum + Number(ability?.powerCost ?? 0), 0);
    const auraSpent = (blueprint?.resources?.auras ?? []).reduce((sum, entry) => sum + Number(entry?.powerCost ?? 0), 0);
    const afflictionSpent = (blueprint?.resources?.afflictions ?? []).reduce((sum, entry) => sum + Number(entry?.powerCost ?? 0), 0);
    const spellcastingSpent = (blueprint?.combat?.spellcasting ?? []).reduce((sum, entry) => sum + Number(entry?.powerCost ?? 0), 0);
    const spent = abilitySpent + auraSpent + afflictionSpent + spellcastingSpent;
    const limit = Number(specialBudget.limit ?? 0);
    if (Number.isFinite(limit) && spent > limit) issues.push(issue("warning", "SPECIAL_POWER_BUDGET_EXCEEDED", "metadata.specialFeatureBudget", `Abilities, auras, afflictions, and spellcasting spend ${spent} power against a shared budget of ${limit}.`));
    if (Number(specialBudget.spent ?? spent) !== spent) issues.push(issue("warning", "SPECIAL_POWER_BUDGET_STALE", "metadata.specialFeatureBudget.spent", "Stored shared power usage does not match generated content."));
    if (Number(specialBudget.spellcastingSpent ?? spellcastingSpent) !== spellcastingSpent) issues.push(issue("warning", "SPELLCASTING_POWER_BUDGET_STALE", "metadata.specialFeatureBudget.spellcastingSpent", "Stored spellcasting power usage does not match generated spellcasting."));
  }

  const uniqueFamilies = new Set();
  for (const ability of generatedAbilities) {
    if (ability?.uniquePerCreature === false) continue;
    const family = ability?.family;
    if (!family) continue;
    if (uniqueFamilies.has(family)) issues.push(issue("warning", "DUPLICATE_ABILITY_FAMILY", "abilities", `Ability family '${family}' appears more than once.`));
    uniqueFamilies.add(family);
  }
  if (generatedAbilities.length > 4) issues.push(issue("warning", "MANY_ABILITIES", "abilities", "More than four generated abilities can make a creature stat block difficult to run."));

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
