import { SKILL_SLUGS } from "../constants.js";
import { resolveSkillValue } from "./tables.js";

export const SKILL_DEFINITIONS = Object.freeze({
  acrobatics: { attribute: "dex" },
  arcana: { attribute: "int" },
  athletics: { attribute: "str" },
  crafting: { attribute: "int" },
  deception: { attribute: "cha" },
  diplomacy: { attribute: "cha" },
  intimidation: { attribute: "cha" },
  medicine: { attribute: "wis" },
  nature: { attribute: "wis" },
  occultism: { attribute: "int" },
  performance: { attribute: "cha" },
  religion: { attribute: "wis" },
  society: { attribute: "int" },
  stealth: { attribute: "dex" },
  survival: { attribute: "wis" },
  thievery: { attribute: "dex" }
});

const ROLE_SKILL_COUNTS = Object.freeze({
  custom: 3,
  brute: 2,
  magicalStriker: 3,
  skillParagon: 5,
  skirmisher: 3,
  sniper: 3,
  soldier: 3,
  spellcaster: 4
});

const ROLE_SKILL_WEIGHTS = Object.freeze({
  custom: {},
  brute: { athletics: 80, intimidation: 45, survival: 20 },
  magicalStriker: { athletics: 35, arcana: 35, occultism: 20, religion: 20, nature: 20, intimidation: 20 },
  skillParagon: { acrobatics: 35, stealth: 35, thievery: 30, deception: 30, diplomacy: 25, society: 25, survival: 20 },
  skirmisher: { acrobatics: 70, stealth: 60, athletics: 25, survival: 25, thievery: 15 },
  sniper: { stealth: 80, survival: 50, acrobatics: 20, crafting: 10 },
  soldier: { athletics: 60, intimidation: 40, society: 20, survival: 20 },
  spellcaster: { arcana: 35, occultism: 35, religion: 35, nature: 35, society: 15, medicine: 10 }
});

const CATEGORY_SKILL_WEIGHTS = Object.freeze({
  aberration: { occultism: 55, stealth: 20, intimidation: 20, arcana: 15 },
  animal: { athletics: 50, acrobatics: 40, stealth: 45, survival: 60 },
  astral: { occultism: 45, arcana: 35, religion: 20 },
  beast: { athletics: 45, acrobatics: 35, stealth: 35, survival: 50 },
  celestial: { religion: 60, diplomacy: 35, intimidation: 20 },
  construct: { athletics: 35, crafting: 55, arcana: 30 },
  dragon: { athletics: 40, acrobatics: 30, intimidation: 55, arcana: 35, deception: 20 },
  elemental: { nature: 55, athletics: 20, acrobatics: 20 },
  ethereal: { occultism: 45, stealth: 45, arcana: 20 },
  fey: { nature: 55, deception: 45, diplomacy: 30, performance: 30, stealth: 30 },
  fiend: { religion: 40, intimidation: 50, deception: 45, occultism: 25 },
  fungus: { nature: 55, survival: 25, stealth: 20 },
  giant: { athletics: 65, intimidation: 35, survival: 20 },
  humanoid: { society: 25, diplomacy: 20, deception: 20, athletics: 20, crafting: 15 },
  monitor: { religion: 35, society: 30, diplomacy: 20, occultism: 20 },
  ooze: { athletics: 20, stealth: 10 },
  plant: { nature: 60, survival: 25, stealth: 20 },
  undead: { religion: 45, intimidation: 40, stealth: 35, occultism: 35 }
});


const CATEGORY_SKILL_POOLS = Object.freeze({
  animal: Object.freeze(["acrobatics", "athletics", "intimidation", "stealth", "survival"]),
  ooze: Object.freeze(["athletics", "stealth"])
});

const MINDLESS_SKILL_POOL = Object.freeze(["acrobatics", "athletics", "stealth", "survival"]);
const SUBTYPE_SKILL_WEIGHTS = Object.freeze({
  aquatic: { athletics: 20, survival: 35 },
  amphibious: { athletics: 15, survival: 25 },
  incorporeal: { stealth: 55, occultism: 25 },
  mindless: { athletics: 25, acrobatics: 15, stealth: 15, survival: 10 },
  swarm: { acrobatics: 25, stealth: 30 },
  air: { acrobatics: 35, nature: 20 },
  earth: { athletics: 30, nature: 20 },
  fire: { intimidation: 20, nature: 15 },
  water: { athletics: 20, nature: 20 },
  wood: { nature: 35, survival: 20 }
});

function addWeights(target, source, multiplier = 1) {
  for (const [slug, value] of Object.entries(source ?? {})) target[slug] = (target[slug] ?? 0) + value * multiplier;
}

function rankWeight(rank) {
  return ({ terrible: -25, low: 0, moderate: 12, high: 28, extreme: 42 })[rank] ?? 0;
}

function resolveCount(request, role) {
  const configured = request.skills?.count ?? "role";
  if (configured === "role") return ROLE_SKILL_COUNTS[role.id] ?? 3;
  return Math.max(0, Math.min(8, Number(configured) || 0));
}

function pickWithoutReplacement(candidates, count, random) {
  const pool = [...candidates];
  const selected = [];
  while (pool.length && selected.length < count) {
    const picked = random.weightedPick(pool.map((entry) => ({ value: entry, weight: Math.max(1, entry.weight) })));
    if (!picked) break;
    selected.push(picked);
    pool.splice(pool.findIndex((entry) => entry.slug === picked.slug), 1);
  }
  return selected;
}

function resolveRanks(request, role, count, random) {
  if (!count) return [];
  const explicit = request.skills?.primaryRank;
  let primary = explicit && explicit !== "role" ? explicit : "high";
  if (role.id === "skillParagon" && explicit === "role") {
    const extremeChance = request.generation?.variation === "conservative" ? 0.15 : request.generation?.variation === "experimental" ? 0.6 : 0.4;
    primary = random.chance(extremeChance) ? "extreme" : "high";
  }
  const ranks = [primary];
  for (let index = 1; index < count; index += 1) {
    if (role.id === "skillParagon" && index <= 2) ranks.push("high");
    else if (index === count - 1 && count >= 4 && random.chance(0.35)) ranks.push("low");
    else ranks.push("moderate");
  }
  return ranks;
}

export function generateSkills(request, role, level, abilities, random) {
  const count = resolveCount(request, role);
  if (!count) return {};

  const weights = Object.fromEntries(SKILL_SLUGS.map((slug) => [slug, 10]));
  addWeights(weights, ROLE_SKILL_WEIGHTS[role.id]);
  addWeights(weights, CATEGORY_SKILL_WEIGHTS[request.identity.category]);
  for (const subtype of request.identity.subtypes ?? []) addWeights(weights, SUBTYPE_SKILL_WEIGHTS[subtype]);

  for (const slug of request.skills?.preferred ?? []) {
    if (slug in weights) weights[slug] += 100;
  }

  for (const slug of SKILL_SLUGS) {
    const attribute = SKILL_DEFINITIONS[slug].attribute;
    weights[slug] += rankWeight(abilities?.[attribute]?.rank);
    if (request.identity.subtypes?.includes("mindless") && ["arcana", "crafting", "deception", "diplomacy", "medicine", "occultism", "performance", "religion", "society", "thievery"].includes(slug)) {
      weights[slug] = 1;
    }
  }

  const preferred = new Set(request.skills?.preferred ?? []);
  let candidateSlugs = [...SKILL_SLUGS];
  const categoryPool = CATEGORY_SKILL_POOLS[request.identity.category];
  if (categoryPool) candidateSlugs = [...new Set([...categoryPool, ...preferred])];
  if (request.identity.subtypes?.includes("mindless")) candidateSlugs = [...new Set([...MINDLESS_SKILL_POOL, ...preferred])];
  candidateSlugs = candidateSlugs.filter((slug) => SKILL_SLUGS.includes(slug));

  const chosen = pickWithoutReplacement(
    candidateSlugs.map((slug) => ({ slug, weight: weights[slug] })),
    Math.min(count, candidateSlugs.length),
    random.fork("selection")
  );
  const ranks = resolveRanks(request, role, chosen.length, random.fork("ranks"));

  return Object.fromEntries(chosen.map((entry, index) => {
    const rank = ranks[index] ?? "moderate";
    const value = resolveSkillValue(level, rank, random.fork(`value:${entry.slug}`));
    return [entry.slug, {
      slug: entry.slug,
      attribute: SKILL_DEFINITIONS[entry.slug].attribute,
      rank,
      value,
      special: [],
      locked: false
    }];
  }));
}
