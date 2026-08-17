import { deepClone } from "./clone.js";
import { SPELL_ATTACK_TABLE, SPELL_DC_TABLE, resolveRankValue } from "./tables.js";

const TRADITIONS = Object.freeze(["arcane", "divine", "occult", "primal"]);
const STYLES = Object.freeze(["innate", "prepared", "spontaneous"]);
const BREADTH_COUNTS = Object.freeze({ focused: 4, standard: 6, broad: 9 });
const BREADTH_COST = Object.freeze({ focused: 2, standard: 3, broad: 4 });
const ROLE_PRESENCE = Object.freeze({ spellcaster: 1.0, magicalStriker: 0.55, skillParagon: 0.18, soldier: 0.08, skirmisher: 0.05, sniper: 0.05, brute: 0.03, custom: 0.12 });
const CATEGORY_PRESENCE = Object.freeze({ dragon: 0.18, fey: 0.2, celestial: 0.2, fiend: 0.2, aberration: 0.12, undead: 0.11, monitor: 0.16, elemental: 0.08, construct: -0.08, animal: -0.12, ooze: -0.14 });
const SUBTYPE_PRESENCE = Object.freeze({ ghost: 0.1, holy: 0.08, unholy: 0.08, angel: 0.1, azata: 0.1, demon: 0.08, devil: 0.08, daemon: 0.08, psychopomp: 0.1, mindless: -0.8 });

const CATEGORY_TRADITIONS = Object.freeze({
  aberration: { occult: 45, arcane: 25, primal: 8, divine: 5 },
  celestial: { divine: 70, primal: 15, occult: 8, arcane: 5 },
  dragon: { arcane: 45, primal: 30, divine: 12, occult: 12 },
  elemental: { primal: 65, arcane: 25, divine: 5, occult: 5 },
  fey: { primal: 45, occult: 40, arcane: 12, divine: 3 },
  fiend: { divine: 42, occult: 28, arcane: 22, primal: 5 },
  monitor: { divine: 45, occult: 25, arcane: 15, primal: 10 },
  undead: { occult: 40, divine: 35, arcane: 18, primal: 5 },
  construct: { arcane: 70, occult: 12, primal: 8, divine: 5 },
  humanoid: { arcane: 25, divine: 25, occult: 25, primal: 25 },
  plant: { primal: 70, occult: 10, divine: 10, arcane: 5 },
  fungus: { primal: 48, occult: 35, arcane: 8, divine: 5 },
  animal: { primal: 75, occult: 8, divine: 8, arcane: 4 },
  beast: { primal: 55, arcane: 15, occult: 15, divine: 10 }
});

const CATEGORY_THEMES = Object.freeze({
  aberration: ["mental", "fear", "control", "occult", "movement"],
  celestial: ["holy", "vitality", "healing", "light", "protection", "spirit"],
  dragon: ["area", "control", "protection", "movement"],
  elemental: ["area", "control", "movement", "nature"],
  fey: ["illusion", "emotion", "mental", "nature", "movement", "control"],
  fiend: ["unholy", "fear", "mental", "fire", "control", "void"],
  monitor: ["spirit", "protection", "control", "movement"],
  undead: ["void", "spirit", "fear", "mental", "darkness", "control"],
  construct: ["protection", "force", "electricity", "control"],
  plant: ["nature", "plant", "control", "healing"],
  fungus: ["poison", "disease", "mental", "control", "nature"],
  animal: ["nature", "movement", "transformation"],
  beast: ["nature", "movement", "transformation"]
});

const SUBTYPE_THEMES = Object.freeze({
  fire: ["fire"], cold: ["cold"], electricity: ["electricity"], acid: ["acid"], poison: ["poison"], disease: ["disease"],
  air: ["air", "movement", "electricity"], earth: ["earth", "protection"], water: ["water", "cold", "control"], wood: ["wood", "plant", "nature"],
  ghost: ["spirit", "fear", "mental", "void", "darkness", "movement"], holy: ["holy", "vitality", "healing", "light"],
  unholy: ["unholy", "fear", "void", "darkness"], angel: ["holy", "healing", "light"], azata: ["emotion", "illusion", "holy"],
  demon: ["unholy", "fear", "chaos"], devil: ["unholy", "fire", "control"], daemon: ["unholy", "death", "void"],
  psychopomp: ["spirit", "death", "protection", "movement"], protean: ["transformation", "movement", "chaos"]
});

const ROLE_THEMES = Object.freeze({
  spellcaster: ["control", "area", "protection"], magicalStriker: ["attack-roll", "damage", "movement"],
  sniper: ["attack-roll", "range"], skirmisher: ["movement", "illusion"], soldier: ["protection", "control"],
  brute: ["protection", "transformation"], skillParagon: ["utility", "mental", "illusion"]
});

function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }
function unique(values) { return [...new Set((values ?? []).map(String).filter(Boolean))]; }

export function spellcastingChance({ request, category, subtypes = [], roleId }) {
  const mode = request.spellcasting?.mode ?? request.options?.spellcasting ?? "auto";
  if (["none", "off"].includes(mode)) return 0;
  if (["required", "on"].includes(mode)) return 1;
  let chance = ROLE_PRESENCE[roleId] ?? 0.12;
  chance += CATEGORY_PRESENCE[category] ?? 0;
  for (const subtype of subtypes) chance += SUBTYPE_PRESENCE[subtype] ?? 0;
  if (request.generation?.variation === "conservative") chance *= 0.75;
  if (request.generation?.variation === "experimental") chance *= 1.25;
  return clamp01(chance);
}

function matchingProfiles(registry, context) {
  return registry?.query?.("spellProfile", context) ?? [];
}

function traditionWeights({ category, subtypes, profiles }) {
  const weights = { arcane: 1, divine: 1, occult: 1, primal: 1, ...(CATEGORY_TRADITIONS[category] ?? {}) };
  if (subtypes.includes("holy") || subtypes.includes("angel")) weights.divine += 35;
  if (subtypes.includes("unholy")) { weights.divine += 20; weights.occult += 15; }
  if (subtypes.some((s) => ["fire", "cold", "electricity", "air", "earth", "water", "wood"].includes(s))) weights.primal += 20;
  if (subtypes.includes("ghost")) weights.occult += 30;
  for (const profile of profiles) {
    for (const [tradition, value] of Object.entries(profile.traditionWeights ?? {})) {
      if (TRADITIONS.includes(tradition)) weights[tradition] = Math.max(1, (weights[tradition] ?? 1) + Number(value ?? 0));
    }
  }
  return weights;
}

function chooseTradition(request, context, profiles, random, availableTraditions = TRADITIONS) {
  const configured = request.spellcasting?.tradition ?? "auto";
  if (TRADITIONS.includes(configured)) return configured;
  const allowed = new Set((availableTraditions ?? TRADITIONS).filter((value) => TRADITIONS.includes(value)));
  const weights = traditionWeights({ ...context, profiles });
  const choices = Object.entries(weights)
    .filter(([value]) => allowed.has(value))
    .map(([value, weight]) => ({ value, weight }));
  return random.weightedPick(choices) ?? [...allowed][0] ?? "arcane";
}

function chooseStyle(request, context, random) {
  const configured = request.spellcasting?.style ?? "auto";
  if (STYLES.includes(configured)) return configured;
  const { category, roleId, subtypes } = context;
  const weights = { innate: 45, prepared: 25, spontaneous: 30 };
  if (["dragon", "fey", "celestial", "fiend", "elemental", "aberration"].includes(category)) weights.innate += 35;
  if (["construct", "humanoid"].includes(category)) weights.prepared += 15;
  if (roleId === "spellcaster") { weights.prepared += 25; weights.spontaneous += 25; }
  if (roleId === "magicalStriker") weights.innate += 25;
  if (subtypes.includes("mindless")) return "innate";
  return random.weightedPick(Object.entries(weights).map(([value, weight]) => ({ value, weight })));
}

export function highestSpellRankForLevel(level) {
  return Math.max(1, Math.min(10, Math.ceil(Math.max(1, Number(level)) / 2)));
}

function resolveHighestRank(request, level) {
  const configured = request.spellcasting?.highestRank ?? "auto";
  if (configured !== "auto") return Math.max(1, Math.min(10, Number(configured) || 1));
  return highestSpellRankForLevel(level);
}

function dcRank(request, roleId) {
  const configured = request.spellcasting?.dcRank ?? "role";
  if (["moderate", "high", "extreme"].includes(configured)) return configured;
  return roleId === "spellcaster" ? "high" : roleId === "magicalStriker" ? "moderate" : "moderate";
}

function themeSet({ request, category, subtypes, roleId, profiles }) {
  const themes = new Set([...(CATEGORY_THEMES[category] ?? []), ...(ROLE_THEMES[roleId] ?? [])]);
  for (const subtype of subtypes) for (const theme of SUBTYPE_THEMES[subtype] ?? []) themes.add(theme);
  for (const profile of profiles) for (const theme of profile.preferredThemes ?? profile.tags ?? []) themes.add(theme);
  for (const theme of request.spellcasting?.themes ?? []) themes.add(theme);
  return themes;
}

function priorityThemeSet({ request, subtypes, profiles }) {
  const themes = new Set();
  // Subtype identity and explicit user themes are the strongest signals. Profiles
  // are also curated content-level affinities and deserve more influence than
  // broad role/category utility themes.
  for (const subtype of subtypes) for (const theme of SUBTYPE_THEMES[subtype] ?? []) themes.add(theme);
  for (const profile of profiles) for (const theme of profile.preferredThemes ?? []) themes.add(theme);
  for (const theme of request.spellcasting?.themes ?? []) themes.add(theme);
  return themes;
}

function scoreSpell(spell, { tradition, themes, priorityThemes, roleId, highestRank }) {
  let score = 10;
  if (!spell.traditions?.includes(tradition)) return 0;
  if (spell.level > highestRank && !spell.cantrip) return 0;
  if (spell.rarity === "unique") return 0;
  for (const theme of spell.themes ?? []) {
    if (themes.has(theme)) score += 15;
    if (priorityThemes?.has(theme)) score += 30;
  }
  if (spell.traits?.includes("cantrip")) score += 4;
  if (spell.area) score += roleId === "spellcaster" ? 5 : 1;
  if (spell.defense?.save) score += roleId === "spellcaster" ? 4 : 2;
  if (spell.themes?.includes("control") && roleId === "spellcaster") score += 8;
  if (spell.themes?.includes("movement") && roleId === "skirmisher") score += 8;
  if (spell.themes?.includes("attack-roll") && roleId === "magicalStriker") score += 8;
  return Math.max(1, score);
}

function targetRanks(highestRank, breadth) {
  const count = BREADTH_COUNTS[breadth] ?? 6;
  const ranks = [];
  if (highestRank >= 1) ranks.push(highestRank);
  if (highestRank >= 2) ranks.push(highestRank - 1);
  if (highestRank >= 3) ranks.push(highestRank - 2);
  while (ranks.length < count - 1) ranks.push(Math.max(1, highestRank - (ranks.length % Math.max(1, highestRank))));
  ranks.push(0); // cantrip slot candidate
  return ranks.slice(0, count);
}

function pickSpells({ spells, tradition, themes, priorityThemes, roleId, highestRank, breadth, random, preserve = [], exclude = [] }) {
  const selectedByIndex = [];
  const used = new Set(exclude);
  const preserveByIndex = new Map((preserve ?? []).filter(Boolean).map((entry) => [Number(entry.index), entry.spell]));
  const ranks = targetRanks(highestRank, breadth);

  for (const [index, desiredRank] of ranks.entries()) {
    const kept = preserveByIndex.get(index);
    if (kept) {
      selectedByIndex[index] = deepClone(kept);
      used.add(kept.sourceUuid ?? kept.id);
      continue;
    }

    let candidates = spells.filter((spell) => {
      if (used.has(spell.sourceUuid) || used.has(spell.id)) return false;
      if (!spell.traditions?.includes(tradition)) return false;
      if (desiredRank === 0) return spell.cantrip;
      if (spell.cantrip) return false;
      return spell.level <= desiredRank;
    });
    if (!candidates.length && desiredRank === 0) {
      candidates = spells.filter((spell) => spell.cantrip && spell.traditions?.includes(tradition) && !used.has(spell.sourceUuid));
    }
    if (!candidates.length) continue;

    const picked = random.fork(`spell:${index}`).weightedPick(candidates.map((spell) => ({
      value: spell,
      weight: scoreSpell(spell, { tradition, themes, priorityThemes, roleId, highestRank })
    })));
    if (!picked) continue;

    const castRank = picked.cantrip ? highestRank : Math.max(picked.level, desiredRank);
    selectedByIndex[index] = {
      id: `spell-${index + 1}`,
      sourceUuid: picked.sourceUuid,
      sourceId: picked.id,
      compendiumId: picked.compendiumId,
      name: picked.name,
      img: picked.img,
      slug: picked.slug,
      baseRank: picked.level,
      rank: castRank,
      cantrip: Boolean(picked.cantrip),
      traits: deepClone(picked.traits ?? []),
      traditions: deepClone(picked.traditions ?? []),
      themes: deepClone(picked.themes ?? []),
      uses: null,
      locked: false,
      source: deepClone(picked.source ?? {})
    };
    used.add(picked.sourceUuid);
  }

  return selectedByIndex.filter(Boolean).map((spell, index) => ({ ...spell, id: `spell-${index + 1}` }));
}

export function estimateSpellcastingPower(entry = {}) {
  if (!entry?.enabled) return 0;
  const explicit = Number(entry.powerCost);
  if (entry.powerCost != null && Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.min(10, explicit));
  const breadth = entry.breadth ?? "standard";
  let cost = BREADTH_COST[breadth] ?? 3;
  // Full prepared/spontaneous bookkeeping is already reflected by breadth. Keep
  // standard spellcasting at 3 power so a spellcaster role can actually spend
  // its default shared budget on magic instead of losing spellcasting entirely.
  if (entry.dcRank === "extreme") cost += 1;
  return Math.max(1, Math.min(7, cost));
}

export function generateSpellcasting({ request, registry, spellSources, level, roleId, category, subtypes, random, availableBudget = Infinity, preserve = null, excludeSpellUuids = [] }) {
  const diagnostics = [];
  const mode = request.spellcasting?.mode ?? request.options?.spellcasting ?? "auto";
  if (["none", "off"].includes(mode)) return { spellcasting: [], diagnostics, spent: 0 };
  const chance = spellcastingChance({ request, category, subtypes, roleId });
  if (!["required", "on"].includes(mode) && !random.fork("presence").chance(chance)) return { spellcasting: [], diagnostics, spent: 0 };
  const candidates = spellSources?.listSpells?.(request.sources?.spells ?? []) ?? [];
  if (!candidates.length) {
    diagnostics.push({ level: "warning", code: "SPELL_SOURCES_EMPTY", message: "Spellcasting was selected, but no spells are available from the active spell compendiums." });
    return { spellcasting: [], diagnostics, spent: 0 };
  }
  const context = { level, role: roleId, roleId, category, subtypes };
  const profiles = matchingProfiles(registry, context);
  const highestRank = resolveHighestRank(request, level);
  const availableTraditions = TRADITIONS.filter((candidate) => candidates.some((spell) =>
    spell.traditions?.includes(candidate) && (spell.cantrip || spell.level <= highestRank)
  ));
  const tradition = chooseTradition(request, context, profiles, random.fork("tradition"), availableTraditions);
  const style = chooseStyle(request, context, random.fork("style"));
  const breadth = ["focused", "standard", "broad"].includes(request.spellcasting?.breadth) ? request.spellcasting.breadth : "standard";
  const rank = dcRank(request, roleId);
  const themes = themeSet({ request, category, subtypes, roleId, profiles });
  const priorityThemes = priorityThemeSet({ request, subtypes, profiles });
  const eligible = candidates.filter((spell) => spell.traditions?.includes(tradition) && (spell.cantrip || spell.level <= highestRank));
  if (!eligible.length && TRADITIONS.includes(request.spellcasting?.tradition)) {
    diagnostics.push({
      level: "warning",
      code: "SPELL_TRADITION_SOURCE_EMPTY",
      message: `No ${tradition} spells up to rank ${highestRank} are available from the active spell compendiums.`
    });
  }
  const selectedSpells = pickSpells({
    spells: eligible, tradition, themes, priorityThemes, roleId, highestRank, breadth, random: random.fork("selection"),
    preserve: preserve?.spells?.map((spell, index) => spell?.locked ? { index, spell } : null).filter(Boolean) ?? [],
    exclude: excludeSpellUuids
  });
  if (!selectedSpells.length) {
    diagnostics.push({ level: "warning", code: "SPELL_SELECTION_EMPTY", message: `No eligible ${tradition} spells fit this creature and the active sources.` });
    return { spellcasting: [], diagnostics, spent: 0 };
  }
  if (style === "innate") {
    for (const spell of selectedSpells) spell.uses = spell.cantrip ? null : 1;
  }
  const entry = {
    id: "spellcasting-1",
    enabled: true,
    name: `${tradition} ${style}`,
    tradition,
    style,
    dcRank: rank,
    dc: resolveRankValue(SPELL_DC_TABLE, level, rank),
    attack: resolveRankValue(SPELL_ATTACK_TABLE, level, rank),
    highestRank,
    breadth,
    themes: [...themes],
    spells: selectedSpells,
    powerCost: null,
    source: { moduleId: "pf2e-creature-forge", profileIds: profiles.map((profile) => profile.id) },
    locked: preserve?.locked === true
  };
  entry.powerCost = estimateSpellcastingPower(entry);
  const required = ["required", "on"].includes(mode);
  if (entry.powerCost > availableBudget && !entry.locked && !required) {
    diagnostics.push({ level: "warning", code: "SPELLCASTING_BUDGET_UNAVAILABLE", message: `Spellcasting requires ${entry.powerCost} power, but only ${availableBudget} remains.` });
    return { spellcasting: [], diagnostics, spent: 0 };
  }
  if (required && entry.powerCost > availableBudget) {
    diagnostics.push({ level: "warning", code: "REQUIRED_SPELLCASTING_OVER_BUDGET", message: "Required spellcasting exceeds the shared special-feature power budget and is kept because it was explicitly required." });
  }
  return { spellcasting: [entry], diagnostics, spent: entry.powerCost };
}

export function rerollSpellcasting({ request, registry, spellSources, blueprint, random }) {
  const current = blueprint.combat?.spellcasting?.[0] ?? null;
  if (current?.locked) return { spellcasting: [deepClone(current)], diagnostics: [], spent: estimateSpellcastingPower(current) };
  const totalBudget = Number(blueprint.metadata?.specialFeatureBudget?.limit ?? 0);
  const otherSpent = Number(blueprint.metadata?.specialFeatureBudget?.abilitySpent ?? 0)
    + Number(blueprint.metadata?.specialFeatureBudget?.auraSpent ?? 0)
    + Number(blueprint.metadata?.specialFeatureBudget?.afflictionSpent ?? 0);
  return generateSpellcasting({
    request, registry, spellSources,
    level: blueprint.identity.level,
    roleId: blueprint.identity.role,
    category: blueprint.identity.category,
    subtypes: blueprint.identity.resolvedSubtypes ?? blueprint.identity.subtypes ?? [],
    random,
    availableBudget: Math.max(0, totalBudget - otherSpent),
    preserve: current?.locked ? current : null
  });
}

export function rerollSpellSlot({ request, registry, spellSources, blueprint, targetId, random }) {
  const current = deepClone(blueprint.combat?.spellcasting?.[0]);
  if (!current) return { spellcasting: [], diagnostics: [], spent: 0 };
  const index = current.spells.findIndex((spell) => spell.id === targetId);
  if (index < 0 || current.spells[index]?.locked || current.locked) return { spellcasting: [current], diagnostics: [], spent: estimateSpellcastingPower(current) };
  const previous = current.spells[index];
  const preserve = { ...current, spells: current.spells.map((spell, slot) => slot === index ? null : ({ ...spell, locked: true })) };
  const generated = generateSpellcasting({
    request: { ...deepClone(request), spellcasting: { ...deepClone(request.spellcasting), mode: "required", tradition: current.tradition, style: current.style, highestRank: current.highestRank, breadth: current.breadth, dcRank: current.dcRank } },
    registry, spellSources,
    level: blueprint.identity.level, roleId: blueprint.identity.role, category: blueprint.identity.category,
    subtypes: blueprint.identity.resolvedSubtypes ?? blueprint.identity.subtypes ?? [], random,
    availableBudget: Infinity, preserve,
    excludeSpellUuids: [previous.sourceUuid]
  });
  const entry = generated.spellcasting?.[0];
  if (!entry) return { spellcasting: [current], diagnostics: generated.diagnostics, spent: estimateSpellcastingPower(current) };
  // Preserve slot order and IDs for all unaffected spells.
  entry.spells.forEach((spell, slot) => { spell.id = current.spells[slot]?.id ?? `spell-${slot + 1}`; spell.locked = current.spells[slot]?.locked ?? false; });
  return { spellcasting: [entry], diagnostics: generated.diagnostics, spent: estimateSpellcastingPower(entry) };
}

export const SPELL_TRADITIONS = TRADITIONS;
export const SPELL_STYLES = STYLES;
