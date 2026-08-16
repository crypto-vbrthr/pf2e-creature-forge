import { deepClone } from "./clone.js";

/** GM Core table: Resistances and Weaknesses by creature level (pp. 118-119 DE GM Core). */
export const RESISTANCE_WEAKNESS_TABLE = Object.freeze({
  [-1]: { maximum: 1, minimum: 1 },
  0: { maximum: 3, minimum: 1 },
  1: { maximum: 3, minimum: 2 },
  2: { maximum: 5, minimum: 2 },
  3: { maximum: 6, minimum: 3 },
  4: { maximum: 7, minimum: 4 },
  5: { maximum: 8, minimum: 4 },
  6: { maximum: 9, minimum: 5 },
  7: { maximum: 10, minimum: 5 },
  8: { maximum: 11, minimum: 6 },
  9: { maximum: 12, minimum: 6 },
  10: { maximum: 13, minimum: 7 },
  11: { maximum: 14, minimum: 7 },
  12: { maximum: 15, minimum: 8 },
  13: { maximum: 16, minimum: 8 },
  14: { maximum: 17, minimum: 9 },
  15: { maximum: 18, minimum: 9 },
  16: { maximum: 19, minimum: 9 },
  17: { maximum: 19, minimum: 10 },
  18: { maximum: 20, minimum: 10 },
  19: { maximum: 21, minimum: 11 },
  20: { maximum: 22, minimum: 11 },
  21: { maximum: 23, minimum: 12 },
  22: { maximum: 24, minimum: 12 },
  23: { maximum: 25, minimum: 13 },
  24: { maximum: 26, minimum: 13 }
});

const VARIATION_CHANCE = Object.freeze({ conservative: 0.65, balanced: 1, experimental: 1 });
const KINDS = new Set(["immunity", "resistance", "weakness"]);
const BROAD_RESISTANCES = new Set(["all-damage", "physical"]);

function matchesDefinition(entry, value) {
  return entry?.slug === value || entry?.id === value;
}

function findDefinition(registry, type, value, compendiumIds = []) {
  if (typeof registry?.resolve === "function") return registry.resolve(type, value, { compendiumIds });
  return registry?.list(type)?.find((entry) => matchesDefinition(entry, value)) ?? null;
}

function normalizeSubtypeSlug(registry, value, compendiumIds = []) {
  const entry = findDefinition(registry, "subtype", value, compendiumIds);
  return entry?.slug ?? String(value);
}

function expandSubtypes(registry, selected = [], compendiumIds = []) {
  const result = new Set(selected.map((value) => normalizeSubtypeSlug(registry, value, compendiumIds)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const slug of [...result]) {
      const entry = findDefinition(registry, "subtype", slug, compendiumIds);
      for (const implied of entry?.impliedSubtypes ?? []) {
        const normalized = normalizeSubtypeSlug(registry, implied, compendiumIds);
        if (!result.has(normalized)) {
          result.add(normalized);
          changed = true;
        }
      }
    }
  }
  return [...result];
}

function ruleMatches(rule, context) {
  const when = rule?.when ?? {};
  if (when.categories?.length && !when.categories.includes(context.category)) return false;
  if (when.notCategories?.includes(context.category)) return false;
  if (when.subtypesAll?.some((slug) => !context.subtypes.has(slug))) return false;
  if (when.subtypesAny?.length && !when.subtypesAny.some((slug) => context.subtypes.has(slug))) return false;
  if (when.notSubtypes?.some((slug) => context.subtypes.has(slug))) return false;
  const minimumLevel = Number(when.minimumLevel ?? -1);
  const maximumLevel = Number(when.maximumLevel ?? 24);
  return context.level >= minimumLevel && context.level <= maximumLevel;
}

function resolveChance(rule, variation) {
  if (rule?.mandatory !== false && rule?.chance === undefined) return 1;
  if (typeof rule?.chance === "number") return Math.max(0, Math.min(1, rule.chance));
  if (rule?.chance && typeof rule.chance === "object") {
    return Math.max(0, Math.min(1, Number(rule.chance[variation] ?? rule.chance.balanced ?? 1)));
  }
  return VARIATION_CHANCE[variation] ?? 1;
}

function affinityValue(level, rule) {
  if (Number.isFinite(Number(rule.value))) return Math.max(0, Math.round(Number(rule.value)));
  const row = RESISTANCE_WEAKNESS_TABLE[level] ?? RESISTANCE_WEAKNESS_TABLE[0];
  const scale = rule.scale === "minimum" ? "minimum" : "maximum";
  return row[scale];
}

function sourceFor(definition, rule, kind) {
  return {
    kind,
    contentId: definition?.id ?? null,
    contentType: definition?.type ?? null,
    labelKey: definition?.label ?? null,
    moduleId: definition?.source?.moduleId ?? null,
    bundleId: definition?.source?.bundleId ?? null,
    ruleId: rule?.id ?? null
  };
}

function toAffinity(rule, definition, context, sourceKind) {
  const affinity = {
    type: String(rule.type),
    exceptions: [...new Set((rule.exceptions ?? []).map(String))],
    source: sourceFor(definition, rule, sourceKind),
    locked: Boolean(rule.locked),
    priority: Number(rule.priority ?? 0),
    hpMultiplier: Number.isFinite(Number(rule.hpMultiplier)) ? Number(rule.hpMultiplier) : null
  };
  if (rule.kind !== "immunity") affinity.value = affinityValue(context.level, rule);
  if (rule.kind === "resistance" && rule.doubleVs?.length) affinity.doubleVs = [...new Set(rule.doubleVs.map(String))];
  return affinity;
}

function normalizeManual(kind, entries, context) {
  return (entries ?? []).filter((entry) => entry && typeof entry === "object" && entry.type).map((entry, index) => {
    const rule = { ...deepClone(entry), kind, priority: 10000, locked: entry.locked ?? true };
    return {
      ...toAffinity(rule, { id: `manual.${kind}.${index}`, type: "manual", label: null, source: { moduleId: "manual" } }, context, "manual"),
      source: { kind: "manual", contentId: null, contentType: "manual", labelKey: null, moduleId: "manual", bundleId: null, ruleId: null }
    };
  });
}

function sameAffinity(a, b) {
  return a.type === b.type && JSON.stringify(a.exceptions ?? []) === JSON.stringify(b.exceptions ?? []);
}

function dedupe(entries) {
  const result = [];
  for (const entry of entries.sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0))) {
    const existing = result.find((candidate) => sameAffinity(candidate, entry));
    if (!existing) result.push(entry);
  }
  return result;
}

function resolveCrossKindConflicts(immunities, resistances, weaknesses) {
  const immunityTypes = new Set(immunities.map((entry) => entry.type));
  resistances = resistances.filter((entry) => !immunityTypes.has(entry.type));
  weaknesses = weaknesses.filter((entry) => !immunityTypes.has(entry.type));

  const resistanceByType = new Map(resistances.map((entry) => [entry.type, entry]));
  weaknesses = weaknesses.filter((weakness) => {
    const resistance = resistanceByType.get(weakness.type);
    if (!resistance) return true;
    const weaknessManual = weakness.source?.kind === "manual";
    const resistanceManual = resistance.source?.kind === "manual";
    if (weaknessManual && !resistanceManual) {
      resistances = resistances.filter((entry) => entry !== resistance);
      return true;
    }
    return false;
  });
  return { immunities, resistances, weaknesses };
}

function hpRankMultiplier(hpRank) {
  if (hpRank === "high") return 4;
  if (hpRank === "low") return 1;
  return 2;
}

/**
 * Apply the GM Core's qualitative HP compensation guidance.
 * Weaknesses can receive up to 4x their value in extra HP for a tough creature;
 * broad resistances normally reduce HP. The exact broad-resistance reduction is a
 * Creature Forge balancing convention and is recorded in provenance/diagnostics.
 */
export function calculateAffinityHpAdjustment({ affinities, hpRank = "moderate" } = {}) {
  const reasons = [];
  let value = 0;
  for (const resistance of affinities?.resistances ?? []) {
    if (!BROAD_RESISTANCES.has(resistance.type)) continue;
    const adjustment = -Math.max(1, Math.round(Number(resistance.value ?? 0) * 2));
    value += adjustment;
    reasons.push({ kind: "resistance", type: resistance.type, affinityValue: resistance.value, adjustment });
  }
  for (const weakness of affinities?.weaknesses ?? []) {
    const multiplier = weakness.hpMultiplier ?? hpRankMultiplier(hpRank);
    const adjustment = Math.max(0, Math.round(Number(weakness.value ?? 0) * multiplier));
    value += adjustment;
    reasons.push({ kind: "weakness", type: weakness.type, affinityValue: weakness.value, multiplier, adjustment });
  }
  return { value, reasons };
}

export function generateDefensiveAffinities({ request, registry, level, random, hpRank = "moderate" }) {
  const categorySources = request.sources?.categories ?? [];
  const subtypeSources = request.sources?.subtypes ?? [];
  const categoryDefinition = findDefinition(registry, "category", request.identity.category, categorySources);
  const selectedSubtypeSlugs = expandSubtypes(registry, request.identity.subtypes ?? [], subtypeSources);
  const subtypeDefinitions = selectedSubtypeSlugs.map((slug) => findDefinition(registry, "subtype", slug, subtypeSources)).filter(Boolean);
  const context = {
    level,
    category: categoryDefinition?.slug ?? request.identity.category,
    subtypes: new Set(selectedSubtypeSlugs),
    variation: request.generation?.variation ?? "balanced"
  };

  const grantedTraits = new Set([...(categoryDefinition?.grantedTraits ?? [])]);
  for (const definition of subtypeDefinitions) {
    for (const trait of definition.grantedTraits ?? []) grantedTraits.add(trait);
    if (definition.trait) grantedTraits.add(definition.trait);
  }

  const candidates = { immunity: [], resistance: [], weakness: [] };
  if (request.defensiveAffinities?.mode !== "off") {
    const definitions = [categoryDefinition, ...subtypeDefinitions].filter(Boolean);
    for (const definition of definitions) {
      for (const rule of definition.defensiveAffinities ?? definition.affinities ?? []) {
        if (!KINDS.has(rule?.kind) || !rule?.type || !ruleMatches(rule, context)) continue;
        const chance = resolveChance(rule, context.variation);
        if (chance < 1 && !random.fork(`${definition.id}:${rule.id ?? rule.type}`).chance(chance)) continue;
        candidates[rule.kind].push(toAffinity(rule, definition, context, definition.type));
      }
    }
  }

  candidates.immunity.push(...normalizeManual("immunity", request.defensiveAffinities?.immunities, context));
  candidates.resistance.push(...normalizeManual("resistance", request.defensiveAffinities?.resistances, context));
  candidates.weakness.push(...normalizeManual("weakness", request.defensiveAffinities?.weaknesses, context));

  let immunities = dedupe(candidates.immunity);
  let resistances = dedupe(candidates.resistance);
  let weaknesses = dedupe(candidates.weakness);
  ({ immunities, resistances, weaknesses } = resolveCrossKindConflicts(immunities, resistances, weaknesses));

  const affinities = { immunities, resistances, weaknesses };
  const hpAdjustment = request.defensiveAffinities?.hpCompensation === "off"
    ? { value: 0, reasons: [] }
    : calculateAffinityHpAdjustment({ affinities, hpRank });

  return {
    ...affinities,
    hpAdjustment,
    grantedTraits: [...grantedTraits],
    resolvedSubtypes: selectedSubtypeSlugs
  };
}
