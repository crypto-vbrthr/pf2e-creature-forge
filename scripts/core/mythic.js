import { SKILL_DEFINITIONS } from "./skills.js";
import { resolveRankValue, resolveSkillValue, SPELL_ATTACK_TABLE, SPELL_DC_TABLE } from "./tables.js";

export const MYTHIC_ROLE_IDS = Object.freeze(["auto", "ambusher", "brute", "caster", "striker"]);

const ROLE_BY_CREATURE_ROLE = Object.freeze({
  brute: "brute",
  soldier: "brute",
  spellcaster: "caster",
  skillParagon: "ambusher",
  sniper: "ambusher",
  skirmisher: "striker",
  magicalStriker: "striker",
  custom: "striker"
});

const TRADITION_SKILL = Object.freeze({
  arcane: "arcana",
  divine: "religion",
  occult: "occultism",
  primal: "nature"
});

function action(id, { type = "passive", actionCost = null, nameKey, name, descriptionKey, description, traits = [], pointCost = 0, parameters = {} } = {}) {
  return { id, type, actionCost, nameKey, name, descriptionKey, description, traits, pointCost, parameters, source: { kind: "rules", book: "War of Immortals", page: 168 } };
}

function bestSave(blueprint, allowed, excluded = new Set()) {
  return allowed
    .filter((save) => !excluded.has(save))
    .sort((a, b) => Number(blueprint.statistics?.saves?.[b]?.value ?? -999) - Number(blueprint.statistics?.saves?.[a]?.value ?? -999))[0] ?? null;
}

function ensureExtremeSkill(blueprint, slug) {
  if (!slug || !SKILL_DEFINITIONS[slug]) return;
  blueprint.statistics.skills ??= {};
  blueprint.statistics.skills[slug] = {
    ...(blueprint.statistics.skills[slug] ?? {}),
    slug,
    attribute: SKILL_DEFINITIONS[slug].attribute,
    rank: "extreme",
    value: resolveSkillValue(blueprint.identity.level, "extreme"),
    special: blueprint.statistics.skills[slug]?.special ?? [],
    locked: blueprint.statistics.skills[slug]?.locked ?? false,
    mythicAdjusted: true
  };
}

function chooseSecondMythicSkill(blueprint, primary) {
  const candidates = Object.values(blueprint.statistics?.skills ?? {})
    .filter((skill) => skill?.slug && skill.slug !== primary)
    .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
  return candidates[0]?.slug ?? (primary === "athletics" ? "intimidation" : "athletics");
}

export function resolveMythicRole(request = {}) {
  if (request?.mythic?.enabled !== true) return null;
  const explicit = request?.mythic?.role;
  if (explicit && explicit !== "auto" && MYTHIC_ROLE_IDS.includes(explicit)) return explicit;
  return ROLE_BY_CREATURE_ROLE[request?.identity?.role] ?? "striker";
}

export function prepareMythicRequest(request = {}) {
  const role = resolveMythicRole(request);
  if (role === "caster") {
    request.spellcasting ??= {};
    if (["none", "auto", undefined, null].includes(request.spellcasting.mode)) request.spellcasting.mode = "required";
  }
  return role;
}

function roleAdjustments(blueprint, role) {
  const actions = [];
  const level = Number(blueprint.identity.level);
  const resilience = new Set();
  let resistance = 0;

  if (role === "ambusher") {
    ensureExtremeSkill(blueprint, "stealth");
    resilience.add("reflex");
    if (level >= 7) {
      const save = bestSave(blueprint, ["fortitude", "will"], resilience);
      if (save) resilience.add(save);
    }
    if (level >= 13) {
      const save = bestSave(blueprint, ["fortitude", "will"], resilience);
      if (save) resilience.add(save);
    }
    actions.push(action("mythic-ambush-excellence", {
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Ability.AmbushExcellence",
      name: "Ambush Excellence",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Ability.AmbushExcellence.Description",
      description: "Uses the extreme skill value for Stealth.",
    }));
    actions.push(action("mythic-hazard-immunity", {
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Ability.HazardImmunity",
      name: "Hazard Immunity",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Ability.HazardImmunity.Description",
      description: "Does not trigger reactions of hazards in its own lair and ignores damaging area effects created by those hazards."
    }));
  } else if (role === "brute") {
    ensureExtremeSkill(blueprint, "athletics");
    resistance = Math.max(0, level);
    if (level >= 13) {
      const save = bestSave(blueprint, ["fortitude", "reflex"], resilience);
      if (save) resilience.add(save);
    }
    actions.push(action("mythic-brutish-athleticism", {
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Ability.BrutishAthleticism",
      name: "Brutish Athleticism",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Ability.BrutishAthleticism.Description",
      description: "Uses the extreme skill value for Athletics."
    }));
    actions.push(action("mythic-ferocity", {
      type: "reaction", nameKey: "PF2E_CREATURE_FORGE.Mythic.Ability.Ferocity", name: "Mythic Ferocity",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Ability.Ferocity.Description",
      description: "Cost 1 Mythic Point. Trigger: reduced to 0 HP. Remain conscious at half maximum HP and increase wounded by 1; unavailable at wounded 3.",
      pointCost: 1
    }));
    actions.push(action("mythic-titanic-might", {
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Ability.TitanicMight", name: "Titanic Might",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Ability.TitanicMight.Description",
      description: "Ignores size limitations for actions such as Grapple and Trip."
    }));
  } else if (role === "caster") {
    const entry = blueprint.combat?.spellcasting?.[0];
    if (entry) {
      const rank = level >= 11 ? "extreme" : "high";
      entry.dcRank = rank;
      entry.dc = resolveRankValue(SPELL_DC_TABLE, level, rank);
      entry.attack = resolveRankValue(SPELL_ATTACK_TABLE, level, rank);
      const traditionSkill = TRADITION_SKILL[entry.tradition];
      if (traditionSkill) ensureExtremeSkill(blueprint, traditionSkill);
    }
    if (level >= 1) {
      const first = bestSave(blueprint, ["reflex", "will"], resilience);
      if (first) resilience.add(first);
    }
    if (level >= 7) {
      const second = bestSave(blueprint, ["reflex", "will"], resilience);
      if (second) resilience.add(second);
    }
    actions.push(action("mythic-devastating-magic", {
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Ability.DevastatingMagic", name: "Devastating Magic",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Ability.DevastatingMagic.Description",
      description: "Uses the high spell DC and spell attack modifier for its level, or extreme values from level 11 onward."
    }));
    actions.push(action("mythic-knowledge", {
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Ability.MythicKnowledge", name: "Mythic Knowledge",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Ability.MythicKnowledge.Description",
      description: "Uses the extreme skill value for the skill associated with its magical tradition."
    }));
    actions.push(action("mythic-recharge-spell", {
      type: "action", actionCost: 1, traits: ["concentrate"], pointCost: 1,
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Power.RechargeSpell", name: "Recharge Spell",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Power.RechargeSpell.Description",
      description: "Cost 1 Mythic Point. Regain one expended spell or another limited use of a spell."
    }));
  } else {
    ensureExtremeSkill(blueprint, "acrobatics");
    if (level >= 1) resistance = Math.max(1, Math.floor(level / 2));
    if (level >= 7) resistance = Math.max(1, level);
    if (level >= 13) {
      const save = bestSave(blueprint, ["reflex", "will"], resilience);
      if (save) resilience.add(save);
    }
    actions.push(action("mythic-deadly-striker", {
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Ability.DeadlyStriker", name: "Deadly Striker",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Ability.DeadlyStriker.Description",
      description: "After moving at least 10 feet with Stride, Burrow, Climb, or Fly, the next Strike deals 1d6 additional precision damage."
    }));
    actions.push(action("mythic-mobility", {
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Ability.Mobility", name: "Mythic Mobility",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Ability.Mobility.Description",
      description: "Uses the extreme skill value for Acrobatics."
    }));
    actions.push(action("mythic-unimpeded", {
      type: "action", actionCost: 1, pointCost: 1,
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Power.Unimpeded", name: "Unimpeded",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Power.Unimpeded.Description",
      description: "Cost 1 Mythic Point. End one effect imposing a circumstance penalty to Speed. Escape automatically succeeds against immobilized, grabbed, or restrained."
    }));
  }

  return { actions, resilience: [...resilience], resistance };
}

function basePowerActions(blueprint, role) {
  const level = Number(blueprint.identity.level);
  const actions = [];
  const skills = [];
  if (level >= 4) {
    if (role === "caster") {
      actions.push(action("mythic-remove-condition", {
        type: "action", actionCost: 1, traits: ["concentrate"], pointCost: 1,
        nameKey: "PF2E_CREATURE_FORGE.Mythic.Power.RemoveCondition", name: "Remove a Condition",
        descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Power.RemoveCondition.Description",
        description: "Cost 1 Mythic Point. End one condition currently affecting the creature."
      }));
    } else {
      const primary = role === "ambusher" ? "stealth" : role === "brute" ? "athletics" : "acrobatics";
      skills.push(primary);
      if (level >= 12) skills.push(chooseSecondMythicSkill(blueprint, primary));
      actions.push(action("mythic-skill", {
        type: "free", pointCost: 1,
        nameKey: "PF2E_CREATURE_FORGE.Mythic.Power.MythicSkill", name: "Mythic Skill",
        descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Power.MythicSkill.Description",
        description: `Cost 1 Mythic Point. The next ${skills.map((slug) => slug).join(" or ")} check gains +4 and uses mythic proficiency.`,
        parameters: { skills: [...skills] }
      }));
    }
  }
  if (level >= 10 && role !== "caster") {
    actions.push(action("mythic-recharge", {
      type: "action", actionCost: 1, traits: ["concentrate"], pointCost: 1,
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Power.Recharge", name: "Recharge",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Power.Recharge.Description",
      description: "Cost 1 Mythic Point. Gain another use of a spell or ability that normally has limited uses."
    }));
  }
  if (level >= 17) {
    actions.push(action("mythic-undying-myth", {
      type: "free", nameKey: "PF2E_CREATURE_FORGE.Mythic.Power.UndyingMyth", name: "Undying Myth",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Power.UndyingMyth.Description",
      description: "Cost all remaining Mythic Points. Trigger: the creature would die while it has at least 1 Mythic Point. It remains conscious and regains 50% of its maximum HP."
    }));
  }
  if (level >= 20 && role !== "brute") {
    actions.push(action("mythic-reroll", {
      type: "free", traits: ["fortune"], pointCost: 1,
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Power.Reroll", name: "Reroll",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Power.Reroll.Description",
      description: "Cost 1 Mythic Point. Trigger: the creature fails a check. Reroll the check and use the new result."
    }));
  }
  return { actions, skills };
}

export function applyMythicOverlay(blueprint, request = {}) {
  if (!request?.mythic?.enabled) {
    blueprint.mythic = { enabled: false, role: null, points: { value: 0, max: 0 }, resilience: [], resistance: 0, immunity: null, defenses: false, skillSlugs: [], actions: [] };
    return blueprint;
  }

  const role = resolveMythicRole(request);
  blueprint.identity.traits = [...new Set([...(blueprint.identity.traits ?? []), "mythic"])];
  const roleState = roleAdjustments(blueprint, role);
  const baseState = basePowerActions(blueprint, role);
  const level = Number(blueprint.identity.level);
  let immunity = null;
  if (level >= 23) immunity = ["ambusher", "caster"].includes(role) ? "spells" : "strikes";
  const defenses = level >= 20 && role === "brute";

  if (roleState.resilience.length) {
    roleState.actions.push(action("mythic-resilience", {
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Ability.Resilience", name: "Mythic Resilience",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Ability.Resilience.Description",
      description: `Treat ${roleState.resilience.join(", ")} saves as one degree of success better than rolled.`,
      parameters: { saves: [...roleState.resilience] }
    }));
  }
  if (roleState.resistance > 0) {
    roleState.actions.push(action("mythic-resistance", {
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Ability.Resistance", name: "Mythic Resistance",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Ability.Resistance.Description",
      description: `Resistance ${roleState.resistance} to Strikes made by non-mythic creatures; mythic weapons bypass this resistance.`,
      parameters: { value: roleState.resistance }
    }));
  }
  if (defenses) {
    roleState.actions.push(action("mythic-defenses", {
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Ability.Defenses", name: "Mythic Defenses",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Ability.Defenses.Description",
      description: "Whenever an attacker rolls a critical hit, it must reroll the attack roll and use the new result."
    }));
  }
  if (immunity) {
    roleState.actions.push(action("mythic-immunity", {
      nameKey: "PF2E_CREATURE_FORGE.Mythic.Ability.Immunity", name: "Mythic Immunity",
      descriptionKey: "PF2E_CREATURE_FORGE.Mythic.Ability.Immunity.Description",
      description: immunity === "spells" ? "Immune to harmful spells cast by non-mythic creatures." : "Immune to Strikes with non-mythic weapons and unarmed Strikes from non-mythic characters.",
      parameters: { immunity }
    }));
  }

  blueprint.mythic = {
    enabled: true,
    role,
    points: { value: 3, max: 3 },
    resilience: roleState.resilience,
    resistance: roleState.resistance,
    immunity,
    defenses,
    skillSlugs: baseState.skills,
    actions: [...roleState.actions, ...baseState.actions]
  };
  return blueprint;
}

export function refreshMythicDerivedAdjustments(blueprint) {
  const request = blueprint?.metadata?.requestSnapshot;
  if (!request?.mythic?.enabled) return blueprint;
  return applyMythicOverlay(blueprint, request);
}
