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
        powerCost: Number(ability?.powerCost ?? 0),
        source: deepClone(ability?.source ?? {}),
        applications: deepClone(ability?.applications ?? [])
      }
    }
  };
}


function afflictionTypeLabel(type) {
  const key = `PF2E_CREATURE_FORGE.AfflictionType.${String(type ?? "disease")}`;
  return localizeKey(key, String(type ?? "disease"));
}

function afflictionTriggerLabel(trigger) {
  const map = {
    "on-use": "PF2E_CREATURE_FORGE.Runtime.AfflictionTrigger.OnUse",
    "on-hit": "PF2E_CREATURE_FORGE.Runtime.AfflictionTrigger.OnHit",
    "on-damage": "PF2E_CREATURE_FORGE.Runtime.AfflictionTrigger.OnDamage",
    "failed-save": "PF2E_CREATURE_FORGE.Runtime.AfflictionTrigger.FailedSave",
    "critical-failure": "PF2E_CREATURE_FORGE.Runtime.AfflictionTrigger.CriticalFailure",
    manual: "PF2E_CREATURE_FORGE.Runtime.AfflictionTrigger.Manual"
  };
  return localizeKey(map[String(trigger ?? "manual")] ?? map.manual, String(trigger ?? "manual"));
}

function afflictionApplicationLabel(application) {
  const map = {
    automatic: "PF2E_CREATURE_FORGE.Runtime.AfflictionApplication.Automatic",
    prompt: "PF2E_CREATURE_FORGE.Runtime.AfflictionApplication.Prompt",
    manual: "PF2E_CREATURE_FORGE.Runtime.AfflictionApplication.Manual"
  };
  return localizeKey(map[String(application ?? "manual")] ?? map.manual, String(application ?? "manual"));
}

export function buildAfflictionDescription(resource, { actorUuid = null, runtimeAvailable = false, binding = null } = {}) {
  const definition = resource?.definition ?? {};
  const description = localizeKey(resource?.descriptionKey, resource?.description ?? definition?.description ?? "");
  const applyLabel = localizeKey("PF2E_CREATURE_FORGE.Action.ApplyAffliction", "Apply affliction");
  const type = afflictionTypeLabel(definition?.afflictionType);
  const button = runtimeAvailable && actorUuid
    ? `<button type="button" class="pf2e-creature-forge-apply-affliction" data-cf-actor-uuid="${escapeAttribute(actorUuid)}" data-cf-affliction-ref="${escapeAttribute(resource?.id)}" title="${escapeAttribute(applyLabel)}"><i class="fa-solid fa-biohazard"></i><span>${applyLabel}</span></button>`
    : "";
  let delivery = "";
  if (binding?.mode === "hosted" && binding.hostItemUuid) {
    const label = localizeKey("PF2E_CREATURE_FORGE.Runtime.AfflictionDelivery", "Delivery");
    const trigger = afflictionTriggerLabel(binding.delivery?.trigger);
    const application = afflictionApplicationLabel(binding.delivery?.application);
    const hostName = escapeAttribute(binding.hostName ?? binding.delivery?.hostId ?? "Host");
    const verified = binding.verified === true || binding.status === "verified"
      ? ` <span class="pf2e-creature-forge-affliction-binding-ok"><i class="fa-solid fa-circle-check"></i> ${escapeAttribute(localizeKey("PF2E_CREATURE_FORGE.Runtime.AfflictionReferenceVerified", "Linked"))}</span>`
      : "";
    delivery = `<div class="pf2e-creature-forge-affliction-delivery"><strong>${label}:</strong> @UUID[${binding.hostItemUuid}]{${hostName}} <span>${escapeAttribute(trigger)} · ${escapeAttribute(application)}</span>${verified}</div>`;
  } else if (binding?.status && !["manual", "verified"].includes(binding.status)) {
    const warning = localizeKey("PF2E_CREATURE_FORGE.Runtime.AfflictionReferenceFailed", "Automatic delivery could not be linked. Manual application remains available.");
    delivery = `<div class="pf2e-creature-forge-affliction-delivery warning"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeAttribute(warning)}</div>`;
  } else if (resource?.delivery?.mode === "manual" || binding?.mode === "manual") {
    delivery = `<div class="pf2e-creature-forge-affliction-delivery"><strong>${localizeKey("PF2E_CREATURE_FORGE.Runtime.AfflictionDelivery", "Delivery")}:</strong> ${escapeAttribute(afflictionTriggerLabel("manual"))}</div>`;
  }
  return `${description ? `<p>${description}</p>` : ""}${delivery}<div class="pf2e-creature-forge-affliction-runtime"><span class="pf2e-creature-forge-affliction-type"><i class="fa-solid fa-biohazard"></i> ${escapeAttribute(type)}</span>${button}</div>`;
}

const AFFLICTION_HOST_BLOCK_START = "<!-- pf2e-creature-forge:host-afflictions:start -->";
const AFFLICTION_HOST_BLOCK_END = "<!-- pf2e-creature-forge:host-afflictions:end -->";

function stripAfflictionHostBlock(current = "") {
  let value = String(current ?? "");
  const start = value.indexOf(AFFLICTION_HOST_BLOCK_START);
  const end = value.indexOf(AFFLICTION_HOST_BLOCK_END);
  if (start >= 0 && end >= start) {
    value = `${value.slice(0, start)}${value.slice(end + AFFLICTION_HOST_BLOCK_END.length)}`;
  }
  // Migration cleanup for 0.4.2-0.5.1 descriptions, which used an unmarked
  // nested div. The generator currently creates at most one hosted Affliction,
  // so consume the complete legacy wrapper rather than the first inner row only.
  value = value.replace(/<div class="pf2e-creature-forge-host-afflictions"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g, "");
  return value.trim();
}

export function buildAfflictionHostDescription(current = "", linked = []) {
  const stripped = stripAfflictionHostBlock(current);
  if (!linked.length) return stripped;
  const title = localizeKey("PF2E_CREATURE_FORGE.Runtime.TransmitsAffliction", "Transmits affliction");
  const rows = linked.map(({ binding, resource }) => {
    const name = localizeKey(resource?.nameKey, resource?.definition?.name ?? resource?.name ?? binding.afflictionRef);
    const trigger = afflictionTriggerLabel(binding.delivery?.trigger);
    const application = afflictionApplicationLabel(binding.delivery?.application);
    const link = binding.templateUuid ? `@UUID[${binding.templateUuid}]{${name}}` : escapeAttribute(name);
    return `<div><i class="fa-solid fa-biohazard"></i> ${link} <span>${escapeAttribute(trigger)} · ${escapeAttribute(application)}</span></div>`;
  }).join("");
  const block = `${AFFLICTION_HOST_BLOCK_START}<div class="pf2e-creature-forge-host-afflictions"><strong>${title}:</strong>${rows}</div>${AFFLICTION_HOST_BLOCK_END}`;
  return `${stripped}${stripped ? "" : ""}${block}`;
}

function compileAfflictionItem(resource) {
  const definition = resource?.definition ?? {};
  const name = localizeKey(resource?.nameKey, definition?.name ?? resource?.name ?? resource?.id ?? "Affliction");
  return {
    name,
    type: "action",
    img: definition?.img ?? "icons/svg/biohazard.svg",
    system: {
      actionType: { value: "passive" },
      actions: { value: null },
      category: "offensive",
      description: { value: buildAfflictionDescription(resource) },
      publication: { title: "PF2E Creature Forge", authors: "", license: "ORC", remaster: true },
      rules: [],
      slug: null,
      traits: { value: [...new Set(definition?.traits ?? [])], rarity: definition?.rarity ?? "common" }
    },
    flags: {
      "pf2e-creature-forge": {
        afflictionRef: resource?.id,
        contentId: resource?.contentId ?? resource?.id,
        powerCost: Number(resource?.powerCost ?? 0),
        source: deepClone(resource?.source ?? {})
      }
    }
  };
}


function spellcastingLabel(entry) {
  const tradition = localizeKey(`PF2E_CREATURE_FORGE.SpellTradition.${entry.tradition}`, entry.tradition);
  const style = localizeKey(`PF2E_CREATURE_FORGE.SpellStyle.${entry.style}`, entry.style);
  return `${tradition} · ${style}`;
}

function compileSpellcastingEntry(entry) {
  return {
    name: spellcastingLabel(entry),
    type: "spellcastingEntry",
    img: "systems/pf2e/icons/default-icons/spellcastingEntry.svg",
    system: {
      autoHeightenLevel: { value: null },
      description: { value: "" },
      prepared: { value: entry.style, flexible: false },
      // NPC spellcasting statistics are supplied explicitly via spelldc. A base
      // proficiency rank of 1 matches current PF2E NPC spellcasting entries and
      // prevents the entry from being interpreted as an untrained character entry.
      proficiency: { value: 1 },
      publication: { title: "PF2E Creature Forge", authors: "", license: "ORC", remaster: true },
      rules: [],
      showSlotlessLevels: { value: false },
      slots: {},
      slug: null,
      spelldc: { dc: Number(entry.dc), value: Number(entry.attack) },
      tradition: { value: entry.tradition },
      traits: {}
    },
    flags: {
      "pf2e-creature-forge": {
        spellcastingId: entry.id,
        tradition: entry.tradition,
        style: entry.style,
        dcRank: entry.dcRank,
        powerCost: Number(entry.powerCost ?? 0)
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
  const afflictionItems = (blueprint.resources?.afflictions ?? []).map(compileAfflictionItem);
  const spellcastingItems = (blueprint.combat?.spellcasting ?? []).map(compileSpellcastingEntry);
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
    items: [...attackItems, ...abilityItems, ...afflictionItems, ...spellcastingItems],
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
