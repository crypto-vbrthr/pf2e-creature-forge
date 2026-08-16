import { deepClone } from "./clone.js";

const weighted = (...pairs) => pairs.map(([value, weight]) => ({ value, weight }));

/**
 * These presets translate the GM Core "Basic Road Maps" into generator defaults.
 * Only values explicitly suggested by a road map are pushed away from moderate defaults.
 */
export const ROLE_PRESETS = Object.freeze({
  custom: {
    id: "custom",
    perception: "moderate",
    ac: "moderate",
    hp: "moderate",
    saves: { fortitude: "moderate", reflex: "moderate", will: "moderate" },
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
    cues: ["strong", "durable", "heavy-damage"]
  },
  magicalStriker: {
    id: "magicalStriker",
    perception: "moderate",
    ac: "moderate",
    hp: "moderate",
    saves: { fortitude: "moderate", reflex: "moderate", will: "moderate" },
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
    cues: ["skills", "combat-skill-ability"]
  },
  skirmisher: {
    id: "skirmisher",
    perception: "moderate",
    ac: "moderate",
    hp: "moderate",
    saves: { fortitude: "low", reflex: "high", will: "moderate" },
    cues: ["dexterous", "fast", "mobile"]
  },
  sniper: {
    id: "sniper",
    perception: "high",
    ac: "moderate",
    hp: weighted(["moderate", 55], ["low", 45]),
    saves: { fortitude: "low", reflex: "high", will: "moderate" },
    cues: ["ranged", "high-attack", "high-damage", "weaker-melee"]
  },
  soldier: {
    id: "soldier",
    perception: "moderate",
    ac: weighted(["high", 80], ["extreme", 20]),
    hp: "moderate",
    saves: { fortitude: "high", reflex: "moderate", will: "moderate" },
    cues: ["strong", "tactical", "reaction"]
  },
  spellcaster: {
    id: "spellcaster",
    perception: "moderate",
    ac: "low",
    hp: "low",
    saves: { fortitude: "low", reflex: "moderate", will: "high" },
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
  return result;
}
