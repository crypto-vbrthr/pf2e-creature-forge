import { deepClone } from "./clone.js";
import { validateBlueprint } from "./validator.js";
import { resolveAttackNameKey } from "./attack-localization.js";
import { MODULE_VERSION } from "../constants.js";
import { localize } from "../i18n.js";

function localizeAttackName(attack) {
  const nameKey = resolveAttackNameKey(attack);
  return nameKey ? localize(nameKey, attack?.name ?? "Strike") : String(attack?.name ?? "Strike");
}

function compileMeleeItem(attack) {
  const damageId = `cf-${String(attack.id ?? "attack").replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
  return {
    name: localizeAttackName(attack),
    type: "melee",
    img: "systems/pf2e/icons/default-icons/melee.svg",
    system: {
      attack: { value: "" },
      attackEffects: { value: [] },
      bonus: { value: Number(attack.attack.value) },
      damageRolls: {
        [damageId]: {
          damage: String(attack.damage.formula),
          damageType: String(attack.damage.type ?? "bludgeoning")
        }
      },
      description: { value: "" },
      publication: { title: "PF2E Creature Forge", authors: "", license: "ORC", remaster: true },
      range: attack.kind === "ranged" ? Number(attack.range ?? 60) : null,
      rules: [],
      slug: null,
      traits: { value: [...new Set(attack.traits ?? [])] }
    },
    flags: {
      "pf2e-creature-forge": {
        attackId: attack.id,
        profile: attack.profile,
        attackRank: attack.attack.rank,
        damageRank: attack.damage.rank
      }
    }
  };
}


const localizeKey = localize;

function abilityActionType(ability) {
  if (ability?.type === "reaction") return "reaction";
  if (ability?.type === "free") return "free";
  if (ability?.type === "passive") return "passive";
  return "action";
}

function escapeAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function effectTimingLabel(timing) {
  const keyByTiming = {
    "after-use": "PF2E_CREATURE_FORGE.Runtime.Timing.AfterUse",
    "trigger": "PF2E_CREATURE_FORGE.Runtime.Timing.Trigger",
    "failed-save": "PF2E_CREATURE_FORGE.Runtime.Timing.FailedSave",
    "on-hit": "PF2E_CREATURE_FORGE.Runtime.Timing.OnHit",
    "on-success": "PF2E_CREATURE_FORGE.Runtime.Timing.OnSuccess"
  };
  const key = keyByTiming[String(timing ?? "")];
  return key ? localizeKey(key, timing) : String(timing ?? "");
}

function effectRuntimeLine({ ability, application, applicationIndex, resource, runtimeLink, actorUuid, runtimeAvailable }) {
  const effectName = localizeKey(resource?.nameKey, resource?.definition?.name ?? resource?.name ?? application.ref);
  const linked = runtimeLink?.primaryUuid
    ? `@UUID[${runtimeLink.primaryUuid}]{${effectName}}`
    : `<span class="pf2e-creature-forge-effect-name">${effectName}</span>`;
  const applyLabel = localizeKey("PF2E_CREATURE_FORGE.Action.ApplyEffect", "Apply effect");
  const timingLabel = effectTimingLabel(application?.timing);
  const timing = timingLabel
    ? `<span class="pf2e-creature-forge-effect-timing"><i class="fa-regular fa-clock"></i> ${escapeAttribute(timingLabel)}</span>`
    : "";
  const button = runtimeAvailable && actorUuid
    ? `<button type="button" class="pf2e-creature-forge-apply-effect" data-cf-actor-uuid="${escapeAttribute(actorUuid)}" data-cf-ability-id="${escapeAttribute(ability?.id)}" data-cf-effect-ref="${escapeAttribute(application.ref)}" data-cf-application-index="${applicationIndex}" title="${escapeAttribute(applyLabel)}" aria-label="${escapeAttribute(applyLabel)}"><i class="fa-solid fa-wand-magic-sparkles"></i><span>${applyLabel}</span></button>`
    : "";
  return `<span class="pf2e-creature-forge-runtime-effect"><span class="pf2e-creature-forge-effect-reference"><i class="fa-solid fa-sparkles"></i>${linked}</span>${timing}${button}</span>`;
}

export function buildAbilityDescription(ability, effectResources = new Map(), {
  runtimeLinks = {}, actorUuid = null, runtimeAvailable = false
} = {}) {
  const description = localizeKey(ability?.descriptionKey, ability?.description ?? "");
  const effectApplications = (ability?.applications ?? [])
    .map((application, applicationIndex) => ({ application, applicationIndex }))
    .filter(({ application }) => application.type === "effect" && application.ref);
  let effectNote = "";
  if (effectApplications.length) {
    const lines = effectApplications.map(({ application, applicationIndex }) => {
      const resource = effectResources.get(application.ref);
      if (!resource) return null;
      return effectRuntimeLine({
        ability,
        application,
        applicationIndex,
        resource,
        runtimeLink: runtimeLinks?.[resource.id] ?? runtimeLinks?.[application.ref] ?? null,
        actorUuid,
        runtimeAvailable
      });
    }).filter(Boolean);
    if (lines.length) {
      effectNote = `<div class="pf2e-creature-forge-linked-effects"><strong>${localizeKey("PF2E_CREATURE_FORGE.Editor.LinkedEffects", "Linked effects")}:</strong><div>${lines.join("")}</div></div>`;
    }
  }
  return `${description ? `<p>${description}</p>` : ""}${effectNote}`;
}

function compileAbilityItem(ability, effectResources = new Map()) {
  const name = localizeKey(ability?.nameKey, ability?.name ?? ability?.contentId ?? "Ability");
  const actionType = abilityActionType(ability);
  return {
    name,
    type: "action",
    img: ability?.img ?? (actionType === "reaction" ? "systems/pf2e/icons/actions/Reaction.webp" : actionType === "free" ? "systems/pf2e/icons/actions/FreeAction.webp" : actionType === "passive" ? "systems/pf2e/icons/actions/Passive.webp" : "systems/pf2e/icons/actions/OneAction.webp"),
    system: {
      actionType: { value: actionType },
      actions: { value: actionType === "action" ? Number(ability?.actionCost ?? 1) : null },
      category: ability?.category ?? "offensive",
      description: { value: buildAbilityDescription(ability, effectResources) },
      publication: { title: "PF2E Creature Forge", authors: "", license: "ORC", remaster: true },
      rules: [],
      slug: null,
      traits: { value: [...new Set(ability?.traits ?? [])], rarity: "common" }
    },
    flags: {
      "pf2e-creature-forge": {
        abilityId: ability?.id,
        contentId: ability?.contentId,
        family: ability?.family ?? null,
        applications: deepClone(ability?.applications ?? [])
      }
    }
  };
}

function compileSkills(skills = {}) {
  return Object.fromEntries(Object.entries(skills).map(([slug, skill]) => [slug, {
    base: Number(skill?.value ?? 0),
    special: (skill?.special ?? []).map((entry) => ({ ...entry }))
  }]));
}

function compileSenses(senses = []) {
  return senses.map((sense) => {
    const source = { type: String(sense.type), acuity: String(sense.acuity ?? "precise") };
    if (Number.isFinite(Number(sense.range)) && Number(sense.range) > 0) source.range = Number(sense.range);
    return source;
  });
}


function compileImmunities(entries = []) {
  return entries.map((entry) => {
    const source = { type: String(entry.type) };
    if (entry.exceptions?.length) source.exceptions = deepClone(entry.exceptions);
    return source;
  });
}

function compileWeaknesses(entries = []) {
  return entries.map((entry) => {
    const source = { type: String(entry.type), value: Number(entry.value) };
    if (entry.exceptions?.length) source.exceptions = deepClone(entry.exceptions);
    if (entry.applyOnce !== undefined) source.applyOnce = Boolean(entry.applyOnce);
    return source;
  });
}

function compileResistances(entries = []) {
  return entries.map((entry) => {
    const source = { type: String(entry.type), value: Number(entry.value) };
    if (entry.exceptions?.length) source.exceptions = deepClone(entry.exceptions);
    if (entry.doubleVs?.length) source.doubleVs = deepClone(entry.doubleVs);
    return source;
  });
}

function compileOtherSpeeds(speed = {}) {
  return (speed.other ?? [])
    .filter((entry) => Number(entry?.value) > 0)
    .map((entry) => ({ type: String(entry.type), value: Number(entry.value) }));
}

export function compileActorSource(blueprint, options = {}) {
  const validation = validateBlueprint(blueprint);
  if (!validation.valid) {
    const error = new Error(`Invalid CreatureBlueprint: ${validation.errors.map((entry) => entry.message).join(" ")}`);
    error.validation = validation;
    throw error;
  }

  const name = String(options.name ?? blueprint.identity.name ?? "Creature").trim() || "Creature";
  const hp = Number(blueprint.statistics.hp.value);
  const abilities = Object.fromEntries(
    ["str", "dex", "con", "int", "wis", "cha"].map((ability) => [ability, { mod: Number(blueprint.statistics.abilities?.[ability]?.value ?? 0) }])
  );
  const attackItems = (blueprint.combat?.attacks ?? []).map(compileMeleeItem);
  const effectResources = new Map((blueprint.resources?.effects ?? []).map((resource) => [resource.id, resource]));
  const abilityItems = (blueprint.abilities ?? []).map((ability) => compileAbilityItem(ability, effectResources));
  const skills = compileSkills(blueprint.statistics?.skills ?? {});
  const senses = compileSenses(blueprint.statistics?.senses ?? []);
  const otherSpeeds = compileOtherSpeeds(blueprint.statistics?.speed ?? {});

  const source = {
    name,
    type: "npc",
    img: options.img ?? "icons/creatures/abilities/dragon-breath-purple.webp",
    system: {
      traits: {
        value: [...new Set(blueprint.identity.traits ?? [])],
        rarity: "common",
        size: { value: blueprint.identity.size ?? "med" }
      },
      abilities,
      attributes: {
        ac: { value: Number(blueprint.statistics.ac.value), details: "" },
        adjustment: null,
        hp: { value: hp, max: hp, temp: 0, details: "" },
        immunities: compileImmunities(blueprint.defenses?.immunities ?? []),
        weaknesses: compileWeaknesses(blueprint.defenses?.weaknesses ?? []),
        resistances: compileResistances(blueprint.defenses?.resistances ?? []),
        speed: { value: Number(blueprint.statistics.speed?.land ?? 25), otherSpeeds, details: "" },
        allSaves: { value: "" }
      },
      skills,
      perception: {
        mod: Number(blueprint.statistics.perception.value),
        details: "",
        senses,
        vision: true
      },
      initiative: { statistic: "perception" },
      details: {
        level: { value: Number(blueprint.identity.level) },
        alliance: "opposition",
        languages: { value: [], details: "" },
        blurb: "",
        publicNotes: "",
        privateNotes: "",
        publication: { title: "PF2E Creature Forge", authors: "", license: "ORC", remaster: true }
      },
      saves: {
        fortitude: { value: Number(blueprint.statistics.saves.fortitude.value), saveDetail: "" },
        reflex: { value: Number(blueprint.statistics.saves.reflex.value), saveDetail: "" },
        will: { value: Number(blueprint.statistics.saves.will.value), saveDetail: "" }
      },
      resources: { focus: { value: 0, max: 0 } }
    },
    items: [...attackItems, ...abilityItems],
    flags: {
      "pf2e-creature-forge": {
        blueprintSchemaVersion: blueprint.schemaVersion,
        generatorVersion: blueprint.metadata?.generatorVersion ?? MODULE_VERSION,
        seed: blueprint.metadata?.seed ?? "",
        blueprint: deepClone(blueprint)
      }
    }
  };

  return {
    actorSource: source,
    integrationPlan: {
      attacks: deepClone(blueprint.combat?.attacks ?? []),
      spellcasting: deepClone(blueprint.combat?.spellcasting ?? []),
      abilities: deepClone(blueprint.abilities ?? []),
      effects: deepClone(blueprint.resources?.effects ?? []),
      auras: deepClone(blueprint.resources?.auras ?? []),
      afflictions: deepClone(blueprint.resources?.afflictions ?? []),
      loot: deepClone(blueprint.loot ?? { policy: "auto" })
    },
    validation
  };
}

export async function createActorFromBlueprint(blueprint, options = {}) {
  if (!globalThis.Actor?.create) throw new Error("Foundry Actor API is unavailable.");
  const compiled = compileActorSource(blueprint, options);
  const actor = await globalThis.Actor.create(compiled.actorSource, { renderSheet: false });
  let runtime = null;
  if (typeof options.postCreate === "function") runtime = await options.postCreate(actor, blueprint, compiled);
  if (options.renderSheet ?? true) actor?.sheet?.render?.(true);
  return { actor, compiled, runtime };
}
