import { deepClone } from "./clone.js";

const weighted = (...pairs) => pairs.map(([value, weight]) => ({ value, weight }));

/**
 * These presets translate the GM Core "Basic Road Maps" into generator defaults.
 * They are starting points, not hard classes. Explicit request values always win.
 */
export const ROLE_PRESETS = Object.freeze({
  custom: {
    id: "custom",
    perception: "moderate",
    ac: "moderate",
    hp: "moderate",
    saves: { fortitude: "moderate", reflex: "moderate", will: "moderate" },
    abilities: { str: "moderate", dex: "moderate", con: "moderate", int: "moderate", wis: "moderate", cha: "moderate" },
    offense: { attack: "moderate", damage: "moderate", kind: "melee" },
    speed: 25,
    cues: []
  },
  brute: {
    id: "brute",
    perception: "low",
    ac: weighted(["moderate", 70], ["low", 30]),
    hp: "high",
    saves: {
      fortitude: "high",
      reflex: weighted(["low", 70], ["moderate", 30]),
      will: weighted(["low", 55], ["moderate", 45])
    },
    abilities: { str: "high", dex: "low", con: "high", int: "low", wis: "low", cha: "low" },
    offense: { attack: weighted(["high", 70], ["moderate", 30]), damage: weighted(["high", 70], ["extreme", 30]), kind: "melee" },
    speed: 25,
    cues: ["strong", "durable", "heavy-damage"]
  },
  magicalStriker: {
    id: "magicalStriker",
    perception: "moderate",
    ac: "moderate",
    hp: "moderate",
    saves: { fortitude: "moderate", reflex: "moderate", will: "moderate" },
    abilities: { str: "high", dex: "moderate", con: "moderate", int: "high", wis: "moderate", cha: "moderate" },
    offense: { attack: "high", damage: "high", kind: "melee" },
    speed: 25,
    cues: ["high-attack", "high-damage", "limited-magic"]
  },
  skillParagon: {
    id: "skillParagon",
    perception: "moderate",
    ac: "moderate",
    hp: "moderate",
    saves: {
      fortitude: "low",
      reflex: weighted(["high", 55], ["moderate", 45]),
      will: weighted(["high", 55], ["moderate", 45])
    },
    abilities: { str: "low", dex: "high", con: "low", int: "high", wis: "high", cha: "moderate" },
    offense: { attack: "moderate", damage: "moderate", kind: "melee" },
    speed: 25,
    cues: ["skills", "combat-skill-ability"]
  },
  skirmisher: {
    id: "skirmisher",
    perception: "moderate",
    ac: "moderate",
    hp: "moderate",
    saves: { fortitude: "low", reflex: "high", will: "moderate" },
    abilities: { str: "moderate", dex: "high", con: "low", int: "moderate", wis: "moderate", cha: "low" },
    offense: { attack: "high", damage: "moderate", kind: "melee" },
    speed: 35,
    cues: ["dexterous", "fast", "mobile"]
  },
  sniper: {
    id: "sniper",
    perception: "high",
    ac: "moderate",
    hp: weighted(["moderate", 55], ["low", 45]),
    saves: { fortitude: "low", reflex: "high", will: "moderate" },
    abilities: { str: "low", dex: "high", con: "low", int: "moderate", wis: "high", cha: "low" },
    offense: { attack: weighted(["high", 70], ["moderate", 30]), damage: weighted(["high", 70], ["extreme", 30]), kind: "ranged" },
    speed: 30,
    cues: ["ranged", "high-attack", "high-damage", "weaker-melee"]
  },
  soldier: {
    id: "soldier",
    perception: "moderate",
    ac: weighted(["high", 80], ["extreme", 20]),
    hp: "moderate",
    saves: { fortitude: "high", reflex: "moderate", will: "moderate" },
    abilities: { str: "high", dex: "moderate", con: "high", int: "moderate", wis: "moderate", cha: "low" },
    offense: { attack: "high", damage: "high", kind: "melee" },
    speed: 25,
    cues: ["strong", "tactical", "reaction"]
  },
  spellcaster: {
    id: "spellcaster",
    perception: "moderate",
    ac: "low",
    hp: "low",
    saves: { fortitude: "low", reflex: "moderate", will: "high" },
    abilities: { str: "low", dex: "moderate", con: "low", int: "high", wis: "moderate", cha: "moderate" },
    offense: { attack: "low", damage: "moderate", kind: "melee" },
    speed: 25,
    cues: ["spellcasting", "high-spell-dc", "weak-strikes"]
  }
});

export const ROLE_IDS = Object.freeze(Object.keys(ROLE_PRESETS));

function resolveChoice(value, random) {
  return Array.isArray(value) ? random.weightedPick(value) : value;
}

export function resolveRolePreset(roleId, random) {
  const preset = ROLE_PRESETS[roleId] ?? ROLE_PRESETS.custom;
  const result = deepClone(preset);
  result.perception = resolveChoice(preset.perception, random.fork("perception"));
  result.ac = resolveChoice(preset.ac, random.fork("ac"));
  result.hp = resolveChoice(preset.hp, random.fork("hp"));
  result.saves = Object.fromEntries(
    Object.entries(preset.saves).map(([save, rank]) => [save, resolveChoice(rank, random.fork(`save:${save}`))])
  );
  result.abilities = Object.fromEntries(
    Object.entries(preset.abilities).map(([ability, rank]) => [ability, resolveChoice(rank, random.fork(`ability:${ability}`))])
  );
  result.offense = {
    attack: resolveChoice(preset.offense.attack, random.fork("offense:attack")),
    damage: resolveChoice(preset.offense.damage, random.fork("offense:damage")),
    kind: preset.offense.kind
  };
  return result;
}
