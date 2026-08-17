import { MODULE_ID } from "../constants.js";

const embeddedEffect = (slug, name, components, { duration = { value: 1, unit: "rounds", expiry: "turn-end" }, img = "icons/svg/aura.svg" } = {}) => ({
  schemaVersion: 2,
  id: `${MODULE_ID}.embedded-effect.${slug}`,
  name,
  description: "",
  img,
  duration,
  components,
  application: { targetType: "actor", stacking: "replace", incompatibilityMode: "warn" },
  metadata: { originModule: MODULE_ID, originFeature: "creature-special-feature" }
});

const aura = (slug, nameKey, descriptionKey, { selection = {}, tags = [], powerCost = 3, baseWeight = 50, radius = 15, definition = {} } = {}) => ({
  id: `${MODULE_ID}.aura.${slug}`,
  slug,
  nameKey,
  descriptionKey,
  tags: ["core", "creature-aura", ...tags],
  selection,
  powerCost,
  baseWeight,
  definition: {
    schemaVersion: 1,
    id: `${MODULE_ID}.aura.${slug}`,
    name: slug,
    description: "",
    img: definition.img ?? "icons/svg/aura.svg",
    enabled: true,
    radius,
    abilityId: "",
    targeting: { allies: false, enemies: true, neutral: false, source: false, requiredTraits: [], excludedTraits: [] },
    presenceEffects: [],
    triggers: [],
    metadata: { createdBy: MODULE_ID, originFeature: "creature-aura" },
    ...definition
  }
});

const afflictionStage = (number, { name = "", description = "", effect = null, duration = { value: 1, unit: "rounds" } } = {}) => ({
  id: `stage-${number}`,
  number,
  name,
  description,
  duration,
  expiryAction: "check",
  check: null,
  restrictions: { conditionLocks: [], healing: "none", unhealableDamageTypes: [], blockedCapabilities: [] },
  effectPersistence: "stage",
  effectPersistenceDuration: null,
  effectComponentPersistence: [],
  effectComponentPersistenceDurations: [],
  effect: effect ? { ...effect, duration: { value: -1, unit: "unlimited", expiry: null } } : null,
  numericModifiers: [],
  periodicEffects: [],
  preActionGates: [],
  reactions: []
});

const affliction = (slug, nameKey, descriptionKey, { selection = {}, tags = [], themes = [], type = "disease", powerCost = 3, baseWeight = 50, traits = [], delivery = {}, deliveryProfile = null, stages = [] } = {}) => ({
  id: `${MODULE_ID}.affliction.${slug}`,
  slug,
  nameKey,
  descriptionKey,
  tags: ["core", "creature-affliction", ...tags],
  selection,
  powerCost,
  baseWeight,
  deliveryProfile,
  definition: {
    schemaVersion: 2,
    id: `${MODULE_ID}.affliction.${slug}`,
    name: slug,
    description: "",
    img: type === "poison" ? "icons/svg/poison.svg" : "icons/svg/biohazard.svg",
    afflictionType: type,
    level: 1,
    rarity: "common",
    traits,
    themes,
    saveDefaults: { execution: "player", visibility: "public" },
    identification: { initialState: "identified" },
    delivery: { injuryPoison: false, ...delivery },
    multipleExposure: "default",
    restrictions: { conditionLocks: [], healing: "none", unhealableDamageTypes: [], blockedCapabilities: [] },
    checks: [{ id: "primary", label: "", kind: "save", statistic: "fortitude", dcMode: "fixed", dc: 15, policy: null }],
    initialCheck: {
      checkIds: ["primary"], combine: "single",
      outcomes: {
        criticalSuccess: { action: "reject" }, success: { action: "reject" },
        failure: { action: "set-stage", stage: 1 }, criticalFailure: { action: "set-stage", stage: Math.min(2, stages.length || 2) }
      }
    },
    onset: null,
    maximumDuration: null,
    defaultStageCheck: {
      checkIds: ["primary"], combine: "single",
      outcomes: {
        criticalSuccess: { action: "stage-delta", delta: -2 }, success: { action: "stage-delta", delta: -1 },
        failure: { action: "stage-delta", delta: 1 }, criticalFailure: { action: "stage-delta", delta: 2 }
      }
    },
    progression: { belowStageOne: "recover", aboveMaximumStage: "clamp", virulent: false },
    stages,
    metadata: { originModule: MODULE_ID, originFeature: "creature-affliction" }
  }
});

export const CORE_AURAS = [
  aura("dread-presence", "PF2E_CREATURE_FORGE.Aura.DreadPresence.Name", "PF2E_CREATURE_FORGE.Aura.DreadPresence.Description", {
    tags: ["fear", "mental", "presence"], selection: { categories: ["undead", "fiend", "dragon"], roles: ["spellcaster", "soldier", "brute", "custom"], minimumLevel: 3 }, powerCost: 3, baseWeight: 85,
    definition: {
      img: "icons/svg/terror.svg",
      triggers: [{
        id: "trigger-fear", name: "Dread Presence", event: "enter",
        save: { enabled: true, type: "will", mode: "request", dc: { mode: "fixed", value: 18 } },
        outcomes: {
          criticalSuccess: null, success: null,
          failure: embeddedEffect("dread-presence-failure", "Frightened", [{ type: "condition", slug: "frightened", value: 1 }], { img: "icons/svg/terror.svg" }),
          criticalFailure: embeddedEffect("dread-presence-critical", "Frightened", [{ type: "condition", slug: "frightened", value: 2 }], { img: "icons/svg/terror.svg" })
        },
        immunity: { enabled: true, duration: { value: 10, unit: "minutes" }, scope: "ability", blocksPresence: true, applyOn: ["criticalSuccess", "success"] }
      }]
    }
  }),
  aura("scorching-presence", "PF2E_CREATURE_FORGE.Aura.ScorchingPresence.Name", "PF2E_CREATURE_FORGE.Aura.ScorchingPresence.Description", {
    tags: ["fire", "damage", "elemental"], selection: { anySubtypes: ["fire"], minimumLevel: 2 }, powerCost: 3, baseWeight: 100,
    definition: {
      img: "icons/magic/fire/barrier-wall-flame-ring-yellow.webp",
      triggers: [{
        id: "trigger-heat", name: "Scorching Presence", event: "turnStart",
        save: { enabled: false, type: "fortitude", mode: "request", dc: { mode: "fixed", value: 15 } },
        outcomes: {
          criticalSuccess: null,
          success: embeddedEffect("scorching-presence", "Scorching Presence", [{ type: "damage", formula: "1d6", damageType: "fire" }], { img: "icons/magic/fire/barrier-wall-flame-ring-yellow.webp" }),
          failure: null,
          criticalFailure: null
        },
        immunity: { enabled: false, duration: { value: 1, unit: "minutes" }, scope: "ability", blocksPresence: false, applyOn: [] }
      }]
    }
  }),
  aura("spore-haze", "PF2E_CREATURE_FORGE.Aura.SporeHaze.Name", "PF2E_CREATURE_FORGE.Aura.SporeHaze.Description", {
    tags: ["fungus", "spore", "control"], selection: { categories: ["fungus", "plant"], minimumLevel: 2 }, powerCost: 3, baseWeight: 90,
    definition: {
      img: "icons/magic/nature/root-vine-entangle-foot-green.webp",
      presenceEffects: [{ id: "presence-spores", name: "Spore Haze", effect: embeddedEffect("spore-haze", "Spore Haze", [{ type: "modifier", selector: "fortitude", value: -1, modifierType: "status" }], { duration: { value: -1, unit: "unlimited", expiry: null } }) }]
    }
  }),
  aura("static-field", "PF2E_CREATURE_FORGE.Aura.StaticField.Name", "PF2E_CREATURE_FORGE.Aura.StaticField.Description", {
    tags: ["electricity", "construct", "control"], selection: { categories: ["construct", "elemental"], anySubtypes: ["electricity"], minimumLevel: 3 }, powerCost: 3, baseWeight: 95,
    definition: {
      img: "icons/magic/lightning/bolt-strike-blue.webp",
      triggers: [{
        id: "trigger-static", name: "Static Field", event: "turnStart",
        save: { enabled: true, type: "reflex", mode: "request", dc: { mode: "fixed", value: 18 } },
        outcomes: { criticalSuccess: null, success: null, failure: embeddedEffect("static-field", "Hampered", [{ type: "movement", movementType: "land", value: -10, modifierType: "status" }]), criticalFailure: embeddedEffect("static-field-critical", "Off-Guard", [{ type: "condition", slug: "off-guard" }]) },
        immunity: { enabled: false, duration: { value: 1, unit: "minutes" }, scope: "ability", blocksPresence: false, applyOn: [] }
      }]
    }
  }),
  aura("protective-halo", "PF2E_CREATURE_FORGE.Aura.ProtectiveHalo.Name", "PF2E_CREATURE_FORGE.Aura.ProtectiveHalo.Description", {
    tags: ["celestial", "support", "defense"], selection: { categories: ["celestial"], roles: ["soldier", "spellcaster", "custom"], minimumLevel: 3 }, powerCost: 3, baseWeight: 80,
    definition: {
      targeting: { allies: true, enemies: false, neutral: false, source: true, requiredTraits: [], excludedTraits: [] },
      img: "icons/magic/holy/prayer-hands-glowing-yellow.webp",
      presenceEffects: [{ id: "presence-halo", name: "Protective Halo", effect: embeddedEffect("protective-halo", "Protective Halo", [{ type: "modifier", selector: "ac", value: 1, modifierType: "status" }], { duration: { value: -1, unit: "unlimited", expiry: null } }) }]
    }
  })
];

export const CORE_AFFLICTIONS = [
  affliction("predator-venom", "PF2E_CREATURE_FORGE.Affliction.PredatorVenom.Name", "PF2E_CREATURE_FORGE.Affliction.PredatorVenom.Description", {
    type: "poison", traits: ["poison"], themes: ["venom"], tags: ["poison", "venom", "predator"],
    selection: { categories: ["animal", "beast", "aberration"], anySubtypes: ["poison"], minimumLevel: 1 }, powerCost: 3, baseWeight: 100,
    deliveryProfile: { hostOrder: ["attack"], trigger: "on-damage", application: "automatic", preferredDamageTypes: ["piercing", "slashing"], preferredAttackNames: ["Bite", "Jaws", "Maw", "Claw"] },
    stages: [
      afflictionStage(1, { name: "Stage 1", description: "The venom weakens the victim.", effect: embeddedEffect("predator-venom-1", "Venom", [{ type: "condition", slug: "enfeebled", value: 1 }]) }),
      afflictionStage(2, { name: "Stage 2", description: "The venom severely weakens the victim.", effect: embeddedEffect("predator-venom-2", "Venom", [{ type: "condition", slug: "enfeebled", value: 2 }]) })
    ]
  }),
  affliction("grave-rot", "PF2E_CREATURE_FORGE.Affliction.GraveRot.Name", "PF2E_CREATURE_FORGE.Affliction.GraveRot.Description", {
    type: "disease", traits: ["disease"], themes: ["undead", "decay"], tags: ["undead", "disease", "decay"],
    selection: { categories: ["undead"], minimumLevel: 2 }, powerCost: 3, baseWeight: 75,
    deliveryProfile: { hostOrder: ["attack", "ability"], trigger: "on-hit", application: "automatic", preferredAttackNames: ["Bite", "Jaws", "Claw", "Touch"] },
    stages: [
      afflictionStage(1, { name: "Stage 1", description: "Necrotic weakness spreads through the body.", effect: embeddedEffect("grave-rot-1", "Grave Rot", [{ type: "condition", slug: "enfeebled", value: 1 }]) }),
      afflictionStage(2, { name: "Stage 2", description: "The victim's strength withers further.", effect: embeddedEffect("grave-rot-2", "Grave Rot", [{ type: "condition", slug: "enfeebled", value: 2 }, { type: "condition", slug: "sickened", value: 1 }]) })
    ]
  }),
  affliction("spore-fever", "PF2E_CREATURE_FORGE.Affliction.SporeFever.Name", "PF2E_CREATURE_FORGE.Affliction.SporeFever.Description", {
    type: "disease", traits: ["disease", "fungus"], themes: ["spore", "fungus"], tags: ["fungus", "spore", "disease"],
    selection: { categories: ["fungus", "plant"], minimumLevel: 1 }, powerCost: 3, baseWeight: 100,
    deliveryProfile: { hostOrder: ["ability", "attack"], trigger: "on-use", application: "automatic", preferredAbilityTags: ["spore", "fungus", "area"], preferredAttackNames: ["Spore Lash", "Tendril"] },
    stages: [
      afflictionStage(1, { name: "Stage 1", description: "Spores irritate the victim's senses.", effect: embeddedEffect("spore-fever-1", "Spore Fever", [{ type: "condition", slug: "sickened", value: 1 }]) }),
      afflictionStage(2, { name: "Stage 2", description: "The infection blooms aggressively.", effect: embeddedEffect("spore-fever-2", "Spore Fever", [{ type: "condition", slug: "sickened", value: 2 }]) })
    ]
  }),
  affliction("infernal-taint", "PF2E_CREATURE_FORGE.Affliction.InfernalTaint.Name", "PF2E_CREATURE_FORGE.Affliction.InfernalTaint.Description", {
    type: "curse", traits: ["curse", "unholy"], themes: ["fiend", "corruption"], tags: ["fiend", "curse", "unholy"],
    selection: { categories: ["fiend"], minimumLevel: 5 }, powerCost: 4, baseWeight: 60,
    deliveryProfile: { hostOrder: ["ability", "attack"], trigger: "on-use", application: "prompt", preferredAbilityTags: ["fiend", "unholy", "mental", "fear", "control"] },
    stages: [
      afflictionStage(1, { name: "Stage 1", description: "Unholy influence clouds the victim's resolve.", effect: embeddedEffect("infernal-taint-1", "Infernal Taint", [{ type: "modifier", selector: "will", value: -1, modifierType: "status" }]) }),
      afflictionStage(2, { name: "Stage 2", description: "The corruption deepens.", effect: embeddedEffect("infernal-taint-2", "Infernal Taint", [{ type: "condition", slug: "stupefied", value: 1 }]) })
    ]
  })
];
