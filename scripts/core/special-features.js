import { deepClone } from "./clone.js";

const FREQUENCY_MULTIPLIER = Object.freeze({ rare: 0.55, normal: 1, high: 1.55 });
const BASE_CHANCE = Object.freeze({ aura: 0.14, affliction: 0.14 });

const CATEGORY_AFFINITY = Object.freeze({
  aura: {
    undead: 0.14, fiend: 0.14, celestial: 0.15, dragon: 0.12, elemental: 0.16,
    fey: 0.1, construct: 0.05, fungus: 0.08, plant: 0.05, aberration: 0.08
  },
  affliction: {
    fungus: 0.26, plant: 0.12, undead: 0.12, fiend: 0.1, aberration: 0.08,
    animal: 0.04, beast: 0.04
  }
});

const SUBTYPE_AFFINITY = Object.freeze({
  aura: {
    ghost: 0.28, incorporeal: 0.18, fire: 0.18, cold: 0.13, electricity: 0.18,
    air: 0.1, holy: 0.12, unholy: 0.12, swarm: 0.08
  },
  affliction: {
    poison: 0.46, disease: 0.3, fungus: 0.22, unholy: 0.08, ghost: 0.04
  }
});

function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }

export function estimateSpecialPower(entry = {}, kind = null) {
  if (Number.isFinite(Number(entry.powerCost))) return Math.max(1, Math.min(10, Number(entry.powerCost)));
  if (kind === "aura") return 3;
  if (kind === "affliction") return 3;
  return 2;
}

function sourceAllowed(entry, selected = [], registry, kind) {
  const source = entry?.source ?? {};
  if (source.sourceKind === "compendium") return selected.includes(source.compendiumId);
  if (!source.libraryId) return true;
  const effective = kind === "aura"
    ? registry.resolveAuraLibrarySelection(selected)
    : registry.resolveAfflictionLibrarySelection(selected);
  return effective.includes(source.libraryId);
}

function selectedSources(request, kind) {
  return kind === "aura" ? (request.sources?.auras ?? []) : (request.sources?.afflictions ?? []);
}

export function specialFeatureChance({ request, kind, category, subtypes = [] }) {
  const mode = request.specialFeatures?.[kind === "aura" ? "auras" : "afflictions"]?.mode ?? "auto";
  if (mode === "none") return 0;
  if (mode === "required") return 1;
  const frequency = request.specialFeatures?.frequency ?? "normal";
  let chance = BASE_CHANCE[kind] ?? 0.1;
  chance += CATEGORY_AFFINITY[kind]?.[category] ?? 0;
  for (const subtype of subtypes) chance += SUBTYPE_AFFINITY[kind]?.[subtype] ?? 0;
  chance *= FREQUENCY_MULTIPLIER[frequency] ?? 1;
  return clamp01(chance);
}

function scoreEntry(entry, { category, subtypes, role }) {
  let score = Math.max(1, Number(entry.baseWeight ?? entry.weight ?? 50));
  const selection = entry.selection ?? entry.supports ?? {};
  const tags = new Set(entry.tags ?? []);
  const subtypeSet = new Set(subtypes ?? []);
  if ((selection.categories ?? []).includes(category)) score += 35;
  if ((selection.roles ?? []).includes(role)) score += 20;
  if ((selection.requiredSubtypes ?? []).length) score += 30 * selection.requiredSubtypes.length;
  if ((selection.anySubtypes ?? selection.subtypes ?? []).some((slug) => subtypeSet.has(slug))) score += 35;
  if (tags.has(category)) score += 12;
  for (const subtype of subtypeSet) if (tags.has(subtype)) score += 14;
  return Math.max(1, score);
}

function scaleAuraDefinition(entry, level) {
  const definition = deepClone(entry.definition ?? entry);
  for (const trigger of definition.triggers ?? []) {
    if (trigger?.save?.enabled && trigger?.save?.dc?.mode === "fixed") {
      trigger.save.dc.value = Math.max(14, 14 + Number(level));
    }
  }
  return definition;
}

function scaleAfflictionDefinition(entry, level) {
  const definition = deepClone(entry.definition ?? entry);
  // Definitions bridged from the Affliction Forge library remain canonical.
  // Their level/DC values belong to the source template and must not be silently
  // rewritten when Creature Forge selects them.
  if (entry.preserveDefinitionScale === true || entry.source?.sourceKind === "affliction-forge-library") return definition;
  definition.level = Number(level);
  for (const check of definition.checks ?? []) {
    if (check?.dcMode === "fixed") check.dc = Math.max(14, 14 + Number(level));
  }
  return definition;
}

function materialize(entry, kind, level) {
  return {
    id: entry.id,
    contentId: entry.id,
    name: entry.name ?? entry.slug ?? entry.id,
    nameKey: entry.nameKey ?? null,
    description: entry.description ?? "",
    descriptionKey: entry.descriptionKey ?? null,
    tags: [...new Set(entry.tags ?? [])],
    powerCost: estimateSpecialPower(entry, kind),
    definition: kind === "aura" ? scaleAuraDefinition(entry, level) : scaleAfflictionDefinition(entry, level),
    source: deepClone(entry.source ?? {}),
    deliveryProfile: kind === "affliction" ? deepClone(entry.deliveryProfile ?? null) : null,
    templateUuid: kind === "affliction" ? (entry.templateUuid ?? entry.source?.templateUuid ?? null) : null,
    locked: false
  };
}

function candidateList({ request, registry, kind, level, category, subtypes, role }) {
  const selected = selectedSources(request, kind);
  return registry.query(kind, { level, category, subtypes, role })
    .filter((entry) => sourceAllowed(entry, selected, registry, kind));
}

function pickFeature({ request, registry, kind, level, category, subtypes, role, random, availableBudget, preserve = null, excludeContentIds = [] }) {
  const modeKey = kind === "aura" ? "auras" : "afflictions";
  const mode = request.specialFeatures?.[modeKey]?.mode ?? "auto";
  const diagnostics = [];
  if (preserve?.locked) {
    const copy = deepClone(preserve);
    return { feature: copy, spent: Number(copy.powerCost ?? estimateSpecialPower(copy, kind)), diagnostics };
  }
  if (mode === "none") return { feature: null, spent: 0, diagnostics };
  const candidates = candidateList({ request, registry, kind, level, category, subtypes, role })
    .filter((entry) => !excludeContentIds.includes(entry.id));
  const eligible = candidates.filter((entry) => estimateSpecialPower(entry, kind) <= availableBudget);
  if (!eligible.length) {
    if (mode === "required") diagnostics.push({
      level: "warning",
      code: `REQUIRED_${kind.toUpperCase()}_UNAVAILABLE`,
      message: `A ${kind} was required, but no matching ${kind} fits the active sources and remaining power budget.`
    });
    return { feature: null, spent: 0, diagnostics };
  }
  const chance = specialFeatureChance({ request, kind, category, subtypes });
  if (mode !== "required" && !random.fork(`${kind}:presence`).chance(chance)) return { feature: null, spent: 0, diagnostics };
  const picked = random.fork(`${kind}:pick`).weightedPick(eligible.map((entry) => ({ value: entry, weight: scoreEntry(entry, { category, subtypes, role }) })));
  const feature = materialize(picked, kind, level);
  return { feature, spent: feature.powerCost, diagnostics };
}

export function generateSpecialFeatures({ request, registry, level, roleId, category, subtypes, random, budgetLimit, preserve = {} }) {
  let remaining = Math.max(0, Number(budgetLimit ?? 0));
  const diagnostics = [];
  const auraResult = pickFeature({
    request, registry, kind: "aura", level, category, subtypes, role: roleId,
    random: random.fork("aura"), availableBudget: remaining, preserve: preserve.aura ?? null
  });
  remaining -= auraResult.spent;
  diagnostics.push(...auraResult.diagnostics);
  const afflictionResult = pickFeature({
    request, registry, kind: "affliction", level, category, subtypes, role: roleId,
    random: random.fork("affliction"), availableBudget: remaining, preserve: preserve.affliction ?? null
  });
  remaining -= afflictionResult.spent;
  diagnostics.push(...afflictionResult.diagnostics);
  const spent = auraResult.spent + afflictionResult.spent;
  return {
    auras: auraResult.feature ? [auraResult.feature] : [],
    afflictions: afflictionResult.feature ? [afflictionResult.feature] : [],
    diagnostics,
    budget: {
      limit: Math.max(0, Number(budgetLimit ?? 0)),
      spent,
      remaining: Math.max(0, remaining),
      auraSpent: auraResult.spent,
      afflictionSpent: afflictionResult.spent
    }
  };
}

export function rerollSpecialFeature({ request, registry, blueprint, kind, random }) {
  const listKey = kind === "aura" ? "auras" : "afflictions";
  const current = blueprint.resources?.[listKey]?.[0] ?? null;
  if (current?.locked) return { feature: deepClone(current), diagnostics: [], spent: Number(current.powerCost ?? estimateSpecialPower(current, kind)) };
  const totalBudget = Number(blueprint.metadata?.specialFeatureBudget?.limit ?? blueprint.metadata?.abilityBudget?.limit ?? 0);
  const otherKind = kind === "aura" ? "afflictions" : "auras";
  const other = blueprint.resources?.[otherKind]?.[0] ?? null;
  const abilitySpent = Number(blueprint.metadata?.abilityBudget?.spent ?? 0);
  const otherSpent = Number(other?.powerCost ?? 0);
  const available = Math.max(0, totalBudget - abilitySpent - otherSpent);
  const result = pickFeature({
    request, registry, kind,
    level: blueprint.identity.level,
    category: blueprint.identity.category,
    subtypes: blueprint.identity.resolvedSubtypes ?? blueprint.identity.subtypes ?? [],
    role: blueprint.identity.role,
    random,
    availableBudget: available,
    excludeContentIds: current?.contentId ? [current.contentId] : []
  });
  return { feature: result.feature, diagnostics: result.diagnostics, spent: result.spent };
}
