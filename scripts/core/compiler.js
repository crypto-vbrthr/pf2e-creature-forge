import { deepClone } from "./clone.js";
import { validateBlueprint } from "./validator.js";

const ABILITY_DEFAULTS = Object.freeze({
  str: { mod: 0 }, dex: { mod: 0 }, con: { mod: 0 }, int: { mod: 0 }, wis: { mod: 0 }, cha: { mod: 0 }
});

export function compileActorSource(blueprint, options = {}) {
  const validation = validateBlueprint(blueprint);
  if (!validation.valid) {
    const error = new Error(`Invalid CreatureBlueprint: ${validation.errors.map((entry) => entry.message).join(" ")}`);
    error.validation = validation;
    throw error;
  }

  const name = String(options.name ?? blueprint.identity.name ?? "Creature").trim() || "Creature";
  const hp = Number(blueprint.statistics.hp.value);
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
      abilities: deepClone(ABILITY_DEFAULTS),
      attributes: {
        ac: { value: Number(blueprint.statistics.ac.value), details: "" },
        adjustment: null,
        hp: { value: hp, max: hp, temp: 0, details: "" },
        speed: { value: Number(blueprint.statistics.speed?.land ?? 25), otherSpeeds: [], details: "" },
        allSaves: { value: "" }
      },
      skills: {},
      perception: {
        mod: Number(blueprint.statistics.perception.value),
        details: "",
        senses: [],
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
    flags: {
      "pf2e-creature-forge": {
        blueprintSchemaVersion: blueprint.schemaVersion,
        generatorVersion: blueprint.metadata?.generatorVersion ?? "0.1.0",
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
