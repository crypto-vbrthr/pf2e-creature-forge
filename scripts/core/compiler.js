import { deepClone } from "./clone.js";
import { validateBlueprint } from "./validator.js";
import { resolveAttackNameKey } from "./attack-localization.js";

function localizeAttackName(attack) {
  const nameKey = resolveAttackNameKey(attack);
  if (nameKey && globalThis.game?.i18n?.localize) {
    const localized = globalThis.game.i18n.localize(nameKey);
    if (localized && localized !== nameKey) return localized;
  }
  return String(attack?.name ?? "Strike");
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
    items: attackItems,
    flags: {
      "pf2e-creature-forge": {
        blueprintSchemaVersion: blueprint.schemaVersion,
        generatorVersion: blueprint.metadata?.generatorVersion ?? "0.2.0",
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
  const actor = await globalThis.Actor.create(compiled.actorSource, { renderSheet: options.renderSheet ?? true });
  return { actor, compiled };
}
