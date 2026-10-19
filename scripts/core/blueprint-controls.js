// Stable preview controls. These operate on blueprint values, never on generator
// request ranks. Editable paths are explicitly whitelisted before any mutation.
import { deepClone } from "../core/clone.js";

export const LOCKABLE_SECTIONS = Object.freeze([
  "statistics.abilities", "defenses", "statistics.hp", "defenses.affinities",
  "statistics.skills", "statistics.movement", "statistics.senses",
  "combat.attacks", "spellcasting", "abilities", "auras", "afflictions", "loot"
]);
const LOCKABLE = new Set(LOCKABLE_SECTIONS);

export function sectionLocked(blueprint, scope) {
  return Boolean(LOCKABLE.has(scope) && blueprint?.locks?.[scope]);
}

export function toggleSectionLock(blueprint, scope) {
  if (!blueprint || !LOCKABLE.has(scope)) return false;
  blueprint.locks ??= {};
  blueprint.locks[scope] = !Boolean(blueprint.locks[scope]);
  return true;
}

function replace(parent, property, value) {
  if (parent && value !== undefined) parent[property] = deepClone(value);
}

function mergeLockedById(previous = [], generated = [], key = "id") {
  const result = deepClone(generated);
  const locked = previous.filter((entry) => entry?.locked);
  for (const original of locked) {
    const index = result.findIndex((entry) => entry?.[key] === original[key]);
    if (index >= 0) result[index] = deepClone(original);
    else result.push(deepClone(original));
  }
  return result;
}

export function preserveLockedSections(previous, generated) {
  if (!previous || !generated) return generated;
  const result = generated;
  result.locks = deepClone(previous.locks ?? {});
  const locked = (scope) => sectionLocked(previous, scope);
  if (locked("statistics.abilities")) replace(result.statistics, "abilities", previous.statistics?.abilities);
  if (locked("defenses")) {
    for (const key of ["ac", "hp", "perception", "saves"]) replace(result.statistics, key, previous.statistics?.[key]);
    replace(result, "defenses", previous.defenses);
    for (const key of ["resolvedSubtypes", "traits"]) replace(result.identity, key, previous.identity?.[key]);
  } else {
    if (locked("statistics.hp")) replace(result.statistics, "hp", previous.statistics?.hp);
    if (locked("defenses.affinities")) {
      replace(result, "defenses", previous.defenses);
      replace(result.identity, "resolvedSubtypes", previous.identity?.resolvedSubtypes);
      replace(result.identity, "traits", previous.identity?.traits);
      if (!locked("statistics.hp")) {
        const hp = result.statistics?.hp;
        if (hp) {
          const base = Number(hp.baseValue ?? hp.value);
          hp.adjustment = Number(result.defenses?.hpAdjustment?.value ?? 0);
          hp.value = Math.max(1, base + hp.adjustment);
        }
      }
    }
  }
  if (locked("statistics.skills")) replace(result.statistics, "skills", previous.statistics?.skills);
  else if (previous.statistics?.skills) {
    result.statistics.skills = { ...result.statistics.skills, ...Object.fromEntries(Object.entries(previous.statistics.skills).filter(([, skill]) => skill?.locked).map(([key, skill]) => [key, deepClone(skill)])) };
  }
  if (locked("statistics.movement")) replace(result.statistics, "speed", previous.statistics?.speed);
  if (locked("statistics.senses")) replace(result.statistics, "senses", previous.statistics?.senses);
  else result.statistics.senses = mergeLockedById(previous.statistics?.senses ?? [], result.statistics.senses ?? [], "type");
  if (locked("combat.attacks")) replace(result.combat, "attacks", previous.combat?.attacks);
  else result.combat.attacks = mergeLockedById(previous.combat?.attacks ?? [], result.combat.attacks ?? []);
  if (locked("spellcasting") || previous.combat?.spellcasting?.[0]?.locked) replace(result.combat, "spellcasting", previous.combat?.spellcasting);
  else if (result.combat?.spellcasting?.[0] && previous.combat?.spellcasting?.[0]) {
    result.combat.spellcasting[0].spells = mergeLockedById(previous.combat.spellcasting[0].spells ?? [], result.combat.spellcasting[0].spells ?? []);
  }
  if (locked("abilities")) {
    replace(result, "abilities", previous.abilities);
    replace(result.resources, "effects", previous.resources?.effects);
  } else {
    result.abilities = mergeLockedById(previous.abilities ?? [], result.abilities ?? []);
    // Persist manually edited effect payloads for locked abilities.
    const protectedIds = new Set(result.abilities.filter((entry) => entry.locked).flatMap((ability) => (ability.applications ?? []).filter((entry) => entry.type === "effect").map((entry) => entry.ref)));
    result.resources.effects = mergeLockedById((previous.resources?.effects ?? []).filter((entry) => protectedIds.has(entry.id)).map((entry) => ({ ...entry, locked: true })), result.resources.effects ?? []);
  }
  if (locked("auras") || previous.resources?.auras?.[0]?.locked) replace(result.resources, "auras", previous.resources?.auras);
  if (locked("afflictions") || previous.resources?.afflictions?.[0]?.locked) replace(result.resources, "afflictions", previous.resources?.afflictions);
  if (locked("loot")) replace(result, "loot", previous.loot);
  else if (previous.loot?.channels && result.loot?.channels) {
    for (const [key, channel] of Object.entries(previous.loot.channels)) {
      if (channel?.locked && key in result.loot.channels) result.loot.channels[key] = deepClone(channel);
    }
  }
  return result;
}

export function refreshPreviewBudgets(blueprint) {
  if (!blueprint?.metadata) return;
  const abilities = blueprint.abilities ?? [];
  const abilitySpent = abilities.reduce((sum, value) => sum + Number(value?.powerCost ?? 0), 0);
  const auraSpent = (blueprint.resources?.auras ?? []).reduce((sum, value) => sum + Number(value?.powerCost ?? 0), 0);
  const afflictionSpent = (blueprint.resources?.afflictions ?? []).reduce((sum, value) => sum + Number(value?.powerCost ?? 0), 0);
  const spellcastingSpent = (blueprint.combat?.spellcasting ?? []).reduce((sum, value) => sum + Number(value?.powerCost ?? 0), 0);
  const signatureSpent = abilities.filter((value) => value?.signature?.kind).reduce((sum, value) => sum + Number(value?.powerCost ?? 0), 0);
  const budget = blueprint.metadata.abilityBudget;
  if (budget) {
    budget.spent = abilitySpent;
    budget.remaining = Math.max(0, Number(budget.limit ?? 0) - abilitySpent);
    budget.generatedCount = abilities.length;
  }
  const signature = blueprint.metadata.signatureBudget;
  if (signature) {
    signature.spent = signatureSpent;
    signature.generatedCount = abilities.filter((value) => value?.signature?.kind).length;
  }
  const special = blueprint.metadata.specialFeatureBudget;
  if (special) {
    special.spent = abilitySpent + auraSpent + afflictionSpent + spellcastingSpent;
    special.remaining = Math.max(0, Number(special.limit ?? 0) - special.spent);
    Object.assign(special, { abilitySpent, auraSpent, afflictionSpent, spellcastingSpent, signatureSpent });
  }
}

const SIMPLE_PATHS = new Map([
  ...["str", "dex", "con", "int", "wis", "cha"].map((key) => [`statistics.abilities.${key}.value`, { min: -10, max: 40 }]),
  ["statistics.ac.value", { min: 0, max: 150 }],
  ["statistics.hp.value", { min: 1, max: 100000 }],
  ["statistics.perception.value", { min: -50, max: 150 }],
  ...["fortitude", "reflex", "will"].map((key) => [`statistics.saves.${key}.value`, { min: -50, max: 150 }]),
  ["combat.spellcasting.0.dc", { min: 0, max: 150 }],
  ["combat.spellcasting.0.attack", { min: -50, max: 150 }]
]);
const DYNAMIC = [
  { re: /^statistics\.skills\.([a-z-]+)\.value$/, part: "skills", min: -50, max: 150 },
  { re: /^combat\.attacks\.(\d+)\.attack\.value$/, part: "attacks", min: -50, max: 150 }
];

export function adjustPreviewNumber(blueprint, path, direction) {
  if (!blueprint || !Number.isInteger(direction) || ![-1, 1].includes(direction)) return false;
  const spec = SIMPLE_PATHS.get(path) ?? DYNAMIC.find((entry) => entry.re.test(path));
  if (!spec) return false;
  const segments = path.split(".");
  let parent = blueprint;
  for (const segment of segments.slice(0, -1)) {
    if (segment === "__proto__" || segment === "constructor" || segment === "prototype") return false;
    parent = parent?.[segment];
    if (!parent || typeof parent !== "object") return false;
  }
  const last = segments.at(-1);
  const current = parent[last];
  if (typeof current !== "number" || !Number.isFinite(current)) return false;
  const updated = current + direction;
  if (updated < spec.min || updated > spec.max) return false;
  parent[last] = updated;
  if (path === "statistics.hp.value" && Number.isFinite(blueprint.statistics.hp.baseValue)) {
    blueprint.statistics.hp.baseValue += direction;
  }
  return true;
}
