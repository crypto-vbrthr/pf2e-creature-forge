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

function normalizeCount(request, roleId) {
  const configured = request.abilities?.count ?? "role";
  if (configured !== "role") return Math.max(0, Math.min(5, Number(configured) || 0));
  const base = ROLE_COUNTS[roleId] ?? 2;
  const delta = COMPLEXITY_DELTA[request.abilities?.complexity ?? "standard"] ?? 0;
  return Math.max(0, Math.min(5, base + delta));
}

function sourceAllowed(entry, selected = []) {
  if (entry?.source?.sourceKind !== "compendium") return true;
  return selected.includes(entry.source?.compendiumId);
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

  for (const wanted of entry.synergy?.prefers ?? []) {
    if (selectedTags.has(wanted)) score += 18;
  }
  for (const conflict of entry.synergy?.conflicts ?? []) {
    if (selectedTags.has(conflict)) score -= 40;
  }
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
    traits: [...new Set(entry.traits ?? [])],
    tags: [...new Set(entry.tags ?? [])],
    applications: deepClone(entry.applications ?? []),
    synergy: deepClone(entry.synergy ?? {}),
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
      definition: deepClone(registered.definition ?? registered),
      source: deepClone(registered.source ?? {}),
      locked: false
    });
  }
  return resources;
}

export function listAbilityCandidates({ request, registry, level, roleId, category, subtypes }) {
  const context = { level, role: roleId, category, subtypes };
  return registry.query("ability", context).filter((entry) => sourceAllowed(entry, request.sources?.abilities ?? []));
}

export function generateAbilities({ request, registry, level, roleId, category, subtypes, random, preserve = [], excludeContentIds = [] }) {
  if (request.abilities?.mode === "off") return { abilities: [], effects: [] };
  const count = normalizeCount(request, roleId);
  if (count === 0) return { abilities: [], effects: [] };
  const focus = request.abilities?.focus ?? [];
  const context = { level, role: roleId, category, subtypes };
  const all = listAbilityCandidates({ request, registry, level, roleId, category, subtypes });
  const selected = [];
  const excluded = new Set(excludeContentIds ?? []);
  const preservedByIndex = new Map((preserve ?? []).filter(Boolean).map((entry) => [Number(entry.index), entry.ability]));

  for (let index = 0; index < count; index += 1) {
    const preserved = preservedByIndex.get(index);
    if (preserved) {
      selected.push(deepClone(preserved));
      continue;
    }
    const usedFamilies = new Set(selected.filter((ability) => ability.uniquePerCreature !== false).map((ability) => ability.family));
    const usedContent = new Set(selected.map((ability) => ability.contentId));
    let candidates = all.filter((entry) => {
      if (excluded.has(entry.id)) return false;
      if (usedContent.has(entry.id)) return false;
      if ((entry.uniquePerCreature ?? true) && usedFamilies.has(entry.family ?? entry.slug ?? entry.id)) return false;
      return true;
    });
    if (!candidates.length) candidates = all.filter((entry) => !usedContent.has(entry.id));
    if (!candidates.length) break;
    const picked = random.fork(`ability:${index}`).weightedPick(weightedCandidates(candidates, context, selected, focus));
    selected.push(materializeAbility(picked, index));
  }

  // Stable slot IDs are important for lock/reroll operations even when preserved
  // entries came from an older blueprint.
  selected.forEach((ability, index) => { ability.id = `ability-${index + 1}`; });
  return {
    abilities: selected,
    effects: collectAbilityEffectResources(selected, registry)
  };
}

export function rerollAbilitySlot({ request, registry, blueprint, targetId, random }) {
  const abilities = deepClone(blueprint.abilities ?? []);
  const index = abilities.findIndex((ability) => ability.id === targetId);
  if (index < 0 || abilities[index]?.locked) return { abilities, effects: deepClone(blueprint.resources?.effects ?? []) };

  const previous = abilities[index];
  const preserved = abilities
    .map((ability, slot) => slot === index ? null : { index: slot, ability })
    .filter(Boolean);
  const result = generateAbilities({
    request,
    registry,
    level: blueprint.identity.level,
    roleId: blueprint.identity.role,
    category: blueprint.identity.category,
    subtypes: blueprint.identity.resolvedSubtypes ?? blueprint.identity.subtypes ?? [],
    random,
    preserve: preserved,
    excludeContentIds: [previous.contentId]
  });
  return {
    abilities: result.abilities,
    effects: collectAbilityEffectResources(result.abilities, registry, blueprint.resources?.effects ?? result.effects)
  };
}
