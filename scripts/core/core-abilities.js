import { MODULE_ID } from "../constants.js";

const effect = (slug, nameKey, definition, extra = {}) => ({
  id: `${MODULE_ID}.effect.${slug}`,
  slug,
  nameKey,
  descriptionKey: extra.descriptionKey ?? `${nameKey}.Description`,
  tags: ["core", "creature-effect", ...(extra.tags ?? [])],
  definition: {
    schemaVersion: 2,
    id: `${MODULE_ID}.effect.${slug}`,
    name: extra.name ?? slug,
    description: extra.description ?? "",
    img: extra.img ?? "icons/svg/aura.svg",
    duration: extra.duration ?? { value: 1, unit: "rounds", expiry: "turn-end" },
    components: definition.components ?? [],
    application: {
      targetType: "actor",
      stacking: "replace",
      incompatibilityMode: "warn",
      ...(definition.application ?? {})
    },
    metadata: {
      originModule: MODULE_ID,
      originFeature: "creature-ability",
      tags: ["creature-forge", ...(extra.tags ?? [])],
      ...(definition.metadata ?? {})
    }
  }
});

export const CORE_EFFECTS = [
  effect("frightened-1", "PF2E_CREATURE_FORGE.Effect.Frightened1", {
    components: [{ type: "condition", slug: "frightened", value: 1 }]
  }, { name: "Frightened", img: "icons/svg/terror.svg", tags: ["fear", "mental"] }),
  effect("hampered-10", "PF2E_CREATURE_FORGE.Effect.Hampered10", {
    components: [{ type: "movement", movementType: "land", value: -10, modifierType: "status" }]
  }, { name: "Hampered", img: "icons/svg/wingfoot.svg", tags: ["movement", "control"] }),
  effect("off-guard", "PF2E_CREATURE_FORGE.Effect.OffGuard", {
    components: [{ type: "condition", slug: "off-guard" }]
  }, { name: "Off-Guard", img: "icons/svg/daze.svg", tags: ["control"] }),
  effect("dazzled", "PF2E_CREATURE_FORGE.Effect.Dazzled", {
    components: [{ type: "condition", slug: "dazzled" }]
  }, { name: "Dazzled", img: "icons/svg/light.svg", tags: ["vision", "control"] }),
  effect("enfeebled-1", "PF2E_CREATURE_FORGE.Effect.Enfeebled1", {
    components: [{ type: "condition", slug: "enfeebled", value: 1 }]
  }, { name: "Enfeebled", img: "icons/svg/degen.svg", tags: ["debuff"] }),
  effect("quickened-step", "PF2E_CREATURE_FORGE.Effect.QuickenedStep", {
    components: [{ type: "movement", movementType: "land", value: 10, modifierType: "status" }]
  }, { name: "Quickened Step", img: "icons/svg/wingfoot.svg", tags: ["movement", "self-buff"] }),
  effect("guarded", "PF2E_CREATURE_FORGE.Effect.Guarded", {
    components: [{ type: "modifier", selector: "ac", value: 1, modifierType: "circumstance" }]
  }, { name: "Guarded", img: "icons/svg/shield.svg", tags: ["defense", "self-buff"] }),
  effect("weakened-will", "PF2E_CREATURE_FORGE.Effect.WeakenedWill", {
    components: [{ type: "modifier", selector: "will", value: -1, modifierType: "status" }]
  }, { name: "Weakened Will", img: "icons/svg/terror.svg", tags: ["mental", "debuff"] })
];

const ability = (slug, nameKey, descriptionKey, extra = {}) => ({
  id: `${MODULE_ID}.ability.${slug}`,
  slug,
  nameKey,
  descriptionKey,
  abilityType: extra.type ?? "action",
  actionCost: extra.actionCost ?? (extra.type === "passive" || extra.type === "reaction" || extra.type === "free" ? null : 1),
  category: extra.category ?? "offensive",
  family: extra.family ?? slug,
  uniquePerCreature: extra.uniquePerCreature ?? true,
  baseWeight: extra.baseWeight ?? 50,
  traits: extra.traits ?? [],
  tags: ["core", "creature-ability", ...(extra.tags ?? [])],
  selection: extra.selection ?? {},
  synergy: extra.synergy ?? {},
  applications: extra.applications ?? [],
  requirements: extra.requirements ?? {},
  img: extra.img ?? "systems/pf2e/icons/actions/OneAction.webp"
});

export const CORE_ABILITIES = [
  ability("quick-step", "PF2E_CREATURE_FORGE.Ability.QuickStep.Name", "PF2E_CREATURE_FORGE.Ability.QuickStep.Description", {
    category: "defensive", tags: ["movement", "skirmisher"], selection: { roles: ["skirmisher", "sniper", "skillParagon"] },
    applications: [{ type: "effect", ref: `${MODULE_ID}.effect.quickened-step`, target: "self", timing: "after-use" }], baseWeight: 70
  }),
  ability("defensive-brace", "PF2E_CREATURE_FORGE.Ability.DefensiveBrace.Name", "PF2E_CREATURE_FORGE.Ability.DefensiveBrace.Description", {
    type: "reaction", category: "defensive", tags: ["defense", "reaction"], selection: { roles: ["soldier", "brute"] },
    applications: [{ type: "effect", ref: `${MODULE_ID}.effect.guarded`, target: "self", timing: "trigger" }], baseWeight: 65
  }),
  ability("menacing-display", "PF2E_CREATURE_FORGE.Ability.MenacingDisplay.Name", "PF2E_CREATURE_FORGE.Ability.MenacingDisplay.Description", {
    actionCost: 1, category: "offensive", traits: ["emotion", "fear", "mental"], tags: ["fear", "control"],
    selection: { roles: ["brute", "soldier", "skillParagon", "custom"] },
    applications: [{ type: "effect", ref: `${MODULE_ID}.effect.frightened-1`, target: "target", timing: "failed-save" }], baseWeight: 45
  }),
  ability("pounce", "PF2E_CREATURE_FORGE.Ability.Pounce.Name", "PF2E_CREATURE_FORGE.Ability.Pounce.Description", {
    actionCost: 2, tags: ["movement", "strike", "predator"], selection: { categories: ["animal", "beast"], roles: ["skirmisher", "brute"] },
    synergy: { provides: ["close-distance"], prefers: ["predator", "strike"] }, baseWeight: 90
  }),
  ability("pack-hunter", "PF2E_CREATURE_FORGE.Ability.PackHunter.Name", "PF2E_CREATURE_FORGE.Ability.PackHunter.Description", {
    type: "passive", category: "offensive", tags: ["pack", "teamwork", "predator"], selection: { categories: ["animal", "beast"] },
    synergy: { provides: ["teamwork"], prefers: ["predator"] }, baseWeight: 55
  }),
  ability("terrifying-roar", "PF2E_CREATURE_FORGE.Ability.TerrifyingRoar.Name", "PF2E_CREATURE_FORGE.Ability.TerrifyingRoar.Description", {
    actionCost: 2, traits: ["auditory", "emotion", "fear", "mental"], tags: ["fear", "control", "area"],
    selection: { categories: ["animal", "beast", "dragon", "fiend"], minimumLevel: 3 },
    applications: [{ type: "effect", ref: `${MODULE_ID}.effect.frightened-1`, target: "failed-save-targets", timing: "failed-save" }], baseWeight: 65
  }),
  ability("tail-sweep", "PF2E_CREATURE_FORGE.Ability.TailSweep.Name", "PF2E_CREATURE_FORGE.Ability.TailSweep.Description", {
    actionCost: 2, tags: ["area", "control", "strike"], selection: { categories: ["dragon", "beast"], minimumLevel: 3 }, baseWeight: 65
  }),
  ability("draconic-majesty", "PF2E_CREATURE_FORGE.Ability.DraconicMajesty.Name", "PF2E_CREATURE_FORGE.Ability.DraconicMajesty.Description", {
    type: "passive", category: "defensive", tags: ["dragon", "fear", "presence"], selection: { categories: ["dragon"] }, baseWeight: 55
  }),
  ability("grave-chill", "PF2E_CREATURE_FORGE.Ability.GraveChill.Name", "PF2E_CREATURE_FORGE.Ability.GraveChill.Description", {
    actionCost: 1, tags: ["undead", "cold", "control"], selection: { categories: ["undead"] },
    applications: [{ type: "effect", ref: `${MODULE_ID}.effect.hampered-10`, target: "target", timing: "on-hit" }], baseWeight: 75
  }),
  ability("terrifying-moan", "PF2E_CREATURE_FORGE.Ability.TerrifyingMoan.Name", "PF2E_CREATURE_FORGE.Ability.TerrifyingMoan.Description", {
    actionCost: 2, traits: ["auditory", "emotion", "fear", "mental"], tags: ["ghost", "fear", "area", "control"],
    selection: { categories: ["undead"], anySubtypes: ["ghost", "incorporeal"], minimumLevel: 3 },
    applications: [{ type: "effect", ref: `${MODULE_ID}.effect.frightened-1`, target: "failed-save-targets", timing: "failed-save" }], baseWeight: 100
  }),
  ability("phasing-rush", "PF2E_CREATURE_FORGE.Ability.PhasingRush.Name", "PF2E_CREATURE_FORGE.Ability.PhasingRush.Description", {
    actionCost: 1, category: "defensive", tags: ["ghost", "movement", "incorporeal"],
    selection: { categories: ["undead"], anySubtypes: ["ghost", "incorporeal"] }, baseWeight: 85
  }),
  ability("overdrive", "PF2E_CREATURE_FORGE.Ability.Overdrive.Name", "PF2E_CREATURE_FORGE.Ability.Overdrive.Description", {
    actionCost: 1, category: "offensive", tags: ["construct", "self-buff", "power"], selection: { categories: ["construct"] }, baseWeight: 70
  }),
  ability("reactive-plating", "PF2E_CREATURE_FORGE.Ability.ReactivePlating.Name", "PF2E_CREATURE_FORGE.Ability.ReactivePlating.Description", {
    type: "reaction", category: "defensive", tags: ["construct", "defense", "reaction"], selection: { categories: ["construct"] },
    applications: [{ type: "effect", ref: `${MODULE_ID}.effect.guarded`, target: "self", timing: "trigger" }], baseWeight: 75
  }),
  ability("elemental-burst", "PF2E_CREATURE_FORGE.Ability.ElementalBurst.Name", "PF2E_CREATURE_FORGE.Ability.ElementalBurst.Description", {
    actionCost: 2, tags: ["elemental", "area", "energy"], selection: { categories: ["elemental"], minimumLevel: 1 }, baseWeight: 80
  }),
  ability("burning-wake", "PF2E_CREATURE_FORGE.Ability.BurningWake.Name", "PF2E_CREATURE_FORGE.Ability.BurningWake.Description", {
    actionCost: 2, tags: ["fire", "movement", "area"], selection: { anySubtypes: ["fire"], minimumLevel: 2 }, baseWeight: 95
  }),
  ability("whirlwind-step", "PF2E_CREATURE_FORGE.Ability.WhirlwindStep.Name", "PF2E_CREATURE_FORGE.Ability.WhirlwindStep.Description", {
    actionCost: 1, category: "defensive", tags: ["air", "movement"], selection: { anySubtypes: ["air"] },
    applications: [{ type: "effect", ref: `${MODULE_ID}.effect.quickened-step`, target: "self", timing: "after-use" }], baseWeight: 95
  }),
  ability("beguiling-glamour", "PF2E_CREATURE_FORGE.Ability.BeguilingGlamour.Name", "PF2E_CREATURE_FORGE.Ability.BeguilingGlamour.Description", {
    actionCost: 2, traits: ["illusion", "mental"], tags: ["fey", "mental", "control"], selection: { categories: ["fey"] },
    applications: [{ type: "effect", ref: `${MODULE_ID}.effect.dazzled`, target: "failed-save-target", timing: "failed-save" }], baseWeight: 80
  }),
  ability("cruel-feint", "PF2E_CREATURE_FORGE.Ability.CruelFeint.Name", "PF2E_CREATURE_FORGE.Ability.CruelFeint.Description", {
    actionCost: 1, tags: ["fiend", "deception", "control"], selection: { categories: ["fiend"] },
    applications: [{ type: "effect", ref: `${MODULE_ID}.effect.off-guard`, target: "target", timing: "on-success" }], baseWeight: 70
  }),
  ability("soul-pressure", "PF2E_CREATURE_FORGE.Ability.SoulPressure.Name", "PF2E_CREATURE_FORGE.Ability.SoulPressure.Description", {
    actionCost: 2, traits: ["mental"], tags: ["fiend", "undead", "mental", "debuff"], selection: { categories: ["fiend", "undead"], minimumLevel: 5 },
    applications: [{ type: "effect", ref: `${MODULE_ID}.effect.weakened-will`, target: "failed-save-target", timing: "failed-save" }], baseWeight: 55
  }),
  ability("grasping-roots", "PF2E_CREATURE_FORGE.Ability.GraspingRoots.Name", "PF2E_CREATURE_FORGE.Ability.GraspingRoots.Description", {
    actionCost: 2, tags: ["plant", "control", "area"], selection: { categories: ["plant", "fungus"], minimumLevel: 2 },
    applications: [{ type: "effect", ref: `${MODULE_ID}.effect.hampered-10`, target: "failed-save-targets", timing: "failed-save" }], baseWeight: 85
  }),
  ability("spore-flash", "PF2E_CREATURE_FORGE.Ability.SporeFlash.Name", "PF2E_CREATURE_FORGE.Ability.SporeFlash.Description", {
    actionCost: 2, tags: ["fungus", "spore", "vision", "control"], selection: { categories: ["fungus"] },
    applications: [{ type: "effect", ref: `${MODULE_ID}.effect.dazzled`, target: "failed-save-targets", timing: "failed-save" }], baseWeight: 85
  }),
  ability("engulfing-slam", "PF2E_CREATURE_FORGE.Ability.EngulfingSlam.Name", "PF2E_CREATURE_FORGE.Ability.EngulfingSlam.Description", {
    actionCost: 2, tags: ["ooze", "control", "strike"], selection: { categories: ["ooze"] },
    applications: [{ type: "effect", ref: `${MODULE_ID}.effect.off-guard`, target: "target", timing: "on-hit" }], baseWeight: 85
  }),
  ability("swarming-assault", "PF2E_CREATURE_FORGE.Ability.SwarmingAssault.Name", "PF2E_CREATURE_FORGE.Ability.SwarmingAssault.Description", {
    actionCost: 2, tags: ["swarm", "area", "movement"], selection: { anySubtypes: ["swarm"] }, baseWeight: 100
  }),
  ability("tactical-feint", "PF2E_CREATURE_FORGE.Ability.TacticalFeint.Name", "PF2E_CREATURE_FORGE.Ability.TacticalFeint.Description", {
    actionCost: 1, tags: ["humanoid", "tactical", "control"], selection: { categories: ["humanoid"], roles: ["soldier", "skillParagon", "skirmisher"] },
    applications: [{ type: "effect", ref: `${MODULE_ID}.effect.off-guard`, target: "target", timing: "on-success" }], baseWeight: 70
  }),
  ability("commanding-shout", "PF2E_CREATURE_FORGE.Ability.CommandingShout.Name", "PF2E_CREATURE_FORGE.Ability.CommandingShout.Description", {
    actionCost: 1, category: "defensive", traits: ["auditory"], tags: ["humanoid", "leader", "support"], selection: { categories: ["humanoid"], roles: ["soldier"] }, baseWeight: 45
  }),
  ability("astral-displacement", "PF2E_CREATURE_FORGE.Ability.AstralDisplacement.Name", "PF2E_CREATURE_FORGE.Ability.AstralDisplacement.Description", {
    type: "reaction", category: "defensive", tags: ["astral", "ethereal", "movement", "reaction"], selection: { categories: ["astral", "ethereal"] }, baseWeight: 90
  })
];
