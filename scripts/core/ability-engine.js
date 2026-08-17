import { deepClone } from "./clone.js";

const ROLE_COUNTS = Object.freeze({
  custom: 2,
  brute: 2,
  magicalStriker: 2,
  skillParagon: 2,
  skirmisher: 2,
  sniper: 2,
  soldier: 2,
  spellcaster: 1
});

const COMPLEXITY_DELTA = Object.freeze({ simple: -1, standard: 0, complex: 1 });
const BUDGET_MULTIPLIER = Object.freeze({ simple: 2, standard: 3, complex: 4 });

function normalizeCount(request, roleId) {
  const configured = request.abilities?.count ?? "role";
  if (configured !== "role") return Math.max(0, Math.min(5, Number(configured) || 0));
  const base = ROLE_COUNTS[roleId] ?? 2;
  const delta = COMPLEXITY_DELTA[request.abilities?.complexity ?? "standard"] ?? 0;
  return Math.max(0, Math.min(5, base + delta));
}

export function estimateAbilityPower(entry = {}) {
  if (Number.isFinite(Number(entry.powerCost))) return Math.max(0, Math.min(10, Number(entry.powerCost)));
  const type = entry.abilityType ?? entry.activation?.type ?? "action";
  const actionCost = Number(entry.actionCost ?? entry.activation?.actions ?? 1);
  let cost = type === "passive" || type === "free" ? 1 : type === "reaction" ? 2 : Math.max(1, Math.min(3, actionCost || 1));
  const tags = new Set(entry.tags ?? []);
  if (tags.has("area")) cost += 1;
  const applications = entry.applications ?? [];
  if (applications.some((application) => ["failed-save-targets", "targets", "area"].includes(application?.target))) cost += 1;
  if (applications.length > 1) cost += 1;
  return Math.max(1, Math.min(5, cost));
}

export function resolveAbilityPowerBudget(request, roleId) {
  const count = normalizeCount(request, roleId);
  const configured = request.abilities?.powerBudget ?? "auto";
  if (configured !== "auto") return Math.max(0, Math.min(30, Number(configured) || 0));
  const complexity = request.abilities?.complexity ?? "standard";
  return Math.max(count, count * (BUDGET_MULTIPLIER[complexity] ?? 3));
}

function sourceAllowed(entry, selected = [], registry) {
  const source = entry?.source ?? {};
  if (source.sourceKind === "compendium") return selected.includes(source.compendiumId);
  if (!source.libraryId) return true; // legacy/API-registered loose content stays available
  const effective = registry.resolveAbilityLibrarySelection(selected);
  return effective.includes(source.libraryId);
}

function scoreAbility(entry, context, selected, focus = []) {
  let score = Math.max(1, Number(entry.baseWeight ?? entry.weight ?? 50));
  const selection = entry.selection ?? entry.supports ?? {};
  const tags = new Set(entry.tags ?? []);
  const subtypes = new Set(context.subtypes ?? []);
  const selectedTags = new Set(selected.flatMap((ability) => [
    ...(ability.tags ?? []),
    ...(ability.synergy?.provides ?? [])
  ]));

  if ((selection.categories ?? []).includes(context.category)) score += 35;
  if ((selection.roles ?? []).includes(context.role)) score += 25;
  if ((selection.requiredSubtypes ?? []).length) score += 35 * selection.requiredSubtypes.length;
  if ((selection.anySubtypes ?? selection.subtypes ?? []).some((slug) => subtypes.has(slug))) score += 35;
  for (const subtype of subtypes) if (tags.has(subtype)) score += 15;
  if (tags.has(context.category)) score += 15;
  if (tags.has(context.role)) score += 10;
  for (const item of focus) if (tags.has(item) || entry.category === item) score += 20;

  for (const wanted of entry.synergy?.prefers ?? []) if (selectedTags.has(wanted)) score += 18;
  for (const conflict of entry.synergy?.conflicts ?? []) if (selectedTags.has(conflict)) score -= 40;
  return Math.max(1, score);
}

function weightedCandidates(entries, context, selected, focus) {
  return entries.map((entry) => ({ value: entry, weight: scoreAbility(entry, context, selected, focus) }));
}

function materializeAbility(entry, index) {
  return {
    id: `ability-${index + 1}`,
    contentId: entry.id,
    name: entry.name ?? entry.slug ?? entry.id,
    nameKey: entry.nameKey ?? null,
    description: entry.description ?? "",
    descriptionKey: entry.descriptionKey ?? null,
    type: entry.abilityType ?? entry.activation?.type ?? "action",
    actionCost: entry.actionCost ?? null,
    category: entry.category ?? "offensive",
    family: entry.family ?? entry.slug ?? entry.id,
    uniquePerCreature: entry.uniquePerCreature ?? true,
    powerCost: estimateAbilityPower(entry),
    traits: [...new Set(entry.traits ?? [])],
    tags: [...new Set(entry.tags ?? [])],
    applications: deepClone(entry.applications ?? []),
    synergy: deepClone(entry.synergy ?? {}),
    requirements: deepClone(entry.requirements ?? {}),
    source: deepClone(entry.source ?? {}),
    img: entry.img ?? "systems/pf2e/icons/actions/OneAction.webp",
    locked: false
  };
}

export function collectAbilityEffectResources(abilities, registry, existingResources = []) {
  const existing = new Map((existingResources ?? []).map((resource) => [resource.id, deepClone(resource)]));
  const refs = new Set((abilities ?? []).flatMap((ability) => (ability.applications ?? [])
    .filter((application) => application.type === "effect" && application.ref)
    .map((application) => application.ref)));
  const resources = [];
  for (const ref of refs) {
    if (existing.has(ref)) {
      resources.push(existing.get(ref));
      continue;
    }
    const registered = registry.get("effect", ref);
    if (!registered) continue;
    resources.push({
      id: registered.id,
      contentId: registered.id,
      name: registered.name ?? registered.slug ?? registered.id,
      nameKey: registered.nameKey ?? null,
      descriptionKey: registered.descriptionKey ?? null,
      definition: deepClone(registered.definition ?? registered),
      source: deepClone(registered.source ?? {}),
      locked: false
    });
  }
  return resources;
}

export function listAbilityCandidates({ request, registry, level, roleId, category, subtypes, includeInvalid = false }) {
  const context = { level, role: roleId, category, subtypes };
  const selected = request.sources?.abilities ?? [];
  const candidates = registry.query("ability", context).filter((entry) => sourceAllowed(entry, selected, registry));
  if (includeInvalid) return candidates;
  return candidates.filter((entry) => registry.validateAbilityDependencies(entry).valid);
}

function dependencyDiagnostics({ request, registry, level, roleId, category, subtypes }) {
  const context = { level, role: roleId, category, subtypes };
  const selected = request.sources?.abilities ?? [];
  const candidates = registry.query("ability", context).filter((entry) => sourceAllowed(entry, selected, registry));
  return candidates.flatMap((entry) => {
    const result = registry.validateAbilityDependencies(entry);
    if (result.valid) return [];
    return [{
      level: "warning",
      code: "ABILITY_DEPENDENCY_MISSING",
      contentId: entry.id,
      message: `Ability '${entry.id}' was excluded because required content is missing: ${result.missing.map((item) => `${item.type}:${item.ref}`).join(", ")}.`
    }];
  });
}

export function generateAbilities({ request, registry, level, roleId, category, subtypes, random, preserve = [], excludeContentIds = [], budgetLimitOverride = null }) {
  if (request.abilities?.mode === "off") return { abilities: [], effects: [], diagnostics: [], budget: { limit: 0, spent: 0, remaining: 0, requestedCount: 0, generatedCount: 0 } };
  const count = normalizeCount(request, roleId);
  const budgetLimit = budgetLimitOverride == null ? resolveAbilityPowerBudget(request, roleId) : Math.max(0, Number(budgetLimitOverride) || 0);
  if (count === 0) return { abilities: [], effects: [], diagnostics: [], budget: { limit: budgetLimit, spent: 0, remaining: budgetLimit, requestedCount: 0, generatedCount: 0 } };
  const focus = request.abilities?.focus ?? [];
  const context = { level, role: roleId, category, subtypes };
  const all = listAbilityCandidates({ request, registry, level, roleId, category, subtypes });
  const diagnostics = dependencyDiagnostics({ request, registry, level, roleId, category, subtypes });
  const selected = [];
  const excluded = new Set(excludeContentIds ?? []);
  const preservedByIndex = new Map((preserve ?? []).filter(Boolean).map((entry) => [Number(entry.index), entry.ability]));
  const preservedCosts = new Map([...preservedByIndex.entries()].map(([index, ability]) => [index, Number(ability?.powerCost ?? estimateAbilityPower(ability))]));
  let spent = 0;

  for (let index = 0; index < count; index += 1) {
    const preserved = preservedByIndex.get(index);
    if (preserved) {
      const copy = deepClone(preserved);
      copy.powerCost = preservedCosts.get(index) ?? Number(copy.powerCost ?? estimateAbilityPower(copy));
      selected.push(copy);
      spent += copy.powerCost;
      continue;
    }
    const usedFamilies = new Set(selected.filter((ability) => ability.uniquePerCreature !== false).map((ability) => ability.family));
    const usedContent = new Set(selected.map((ability) => ability.contentId));
    const reservedFuture = [...preservedCosts.entries()]
      .filter(([slot]) => slot > index)
      .reduce((sum, [, cost]) => sum + cost, 0);
    const remaining = Math.max(0, budgetLimit - spent - reservedFuture);
    let candidates = all.filter((entry) => {
      if (excluded.has(entry.id)) return false;
      if (usedContent.has(entry.id)) return false;
      if ((entry.uniquePerCreature ?? true) && usedFamilies.has(entry.family ?? entry.slug ?? entry.id)) return false;
      return estimateAbilityPower(entry) <= remaining;
    });
    if (!candidates.length) candidates = all.filter((entry) => !usedContent.has(entry.id) && estimateAbilityPower(entry) <= remaining);
    if (!candidates.length) break;
    const picked = random.fork(`ability:${index}`).weightedPick(weightedCandidates(candidates, context, selected, focus));
    const materialized = materializeAbility(picked, index);
    selected.push(materialized);
    spent += materialized.powerCost;
  }

  selected.forEach((ability, index) => { ability.id = `ability-${index + 1}`; });
  if (selected.length < count) {
    diagnostics.push({
      level: "warning",
      code: "ABILITY_BUDGET_EXHAUSTED",
      message: `Ability generation stopped at ${selected.length}/${count} entries because the power budget (${budgetLimit}) was exhausted.`
    });
  }
  if (spent > budgetLimit) {
    diagnostics.push({
      level: "warning",
      code: "ABILITY_BUDGET_EXCEEDED_BY_LOCKS",
      message: `Preserved or locked abilities spend ${spent} power against a budget of ${budgetLimit}.`
    });
  }

  return {
    abilities: selected,
    effects: collectAbilityEffectResources(selected, registry),
    diagnostics,
    budget: {
      limit: budgetLimit,
      spent,
      remaining: Math.max(0, budgetLimit - spent),
      requestedCount: count,
      generatedCount: selected.length
    }
  };
}

export function rerollAbilitySlot({ request, registry, blueprint, targetId, random }) {
  const abilities = deepClone(blueprint.abilities ?? []);
  const index = abilities.findIndex((ability) => ability.id === targetId);
  if (index < 0 || abilities[index]?.locked) {
    const spent = abilities.reduce((sum, entry) => sum + Number(entry.powerCost ?? estimateAbilityPower(entry)), 0);
    const limit = resolveAbilityPowerBudget(request, blueprint.identity.role);
    return {
      abilities,
      effects: deepClone(blueprint.resources?.effects ?? []),
      diagnostics: [],
      budget: { limit, spent, remaining: Math.max(0, limit - spent), requestedCount: abilities.length, generatedCount: abilities.length }
    };
  }

  const previous = abilities[index];
  const preserved = abilities.map((ability, slot) => slot === index ? null : { index: slot, ability }).filter(Boolean);
  const specialSpent = Number(blueprint.metadata?.specialFeatureBudget?.auraSpent ?? 0) + Number(blueprint.metadata?.specialFeatureBudget?.afflictionSpent ?? 0);
  const totalBudget = Number(blueprint.metadata?.specialFeatureBudget?.limit ?? resolveAbilityPowerBudget(request, blueprint.identity.role));
  const result = generateAbilities({
    request,
    registry,
    level: blueprint.identity.level,
    roleId: blueprint.identity.role,
    category: blueprint.identity.category,
    subtypes: blueprint.identity.resolvedSubtypes ?? blueprint.identity.subtypes ?? [],
    random,
    preserve: preserved,
    excludeContentIds: [previous.contentId],
    budgetLimitOverride: Math.max(0, totalBudget - specialSpent)
  });
  return {
    abilities: result.abilities,
    effects: collectAbilityEffectResources(result.abilities, registry, blueprint.resources?.effects ?? result.effects),
    diagnostics: result.diagnostics,
    budget: result.budget
  };
}
