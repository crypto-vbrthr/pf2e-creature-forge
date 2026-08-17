import { MODULE_ID } from "./constants.js";
import { deepClone } from "./core/clone.js";
import { format, localize } from "./i18n.js";

const AURA_DEFAULT_NAMES = Object.freeze({
  [`${MODULE_ID}.aura.dread-presence`]: "Dread Presence",
  [`${MODULE_ID}.aura.scorching-presence`]: "Scorching Presence",
  [`${MODULE_ID}.aura.spore-haze`]: "Spore Haze",
  [`${MODULE_ID}.aura.static-field`]: "Static Field",
  [`${MODULE_ID}.aura.protective-halo`]: "Protective Halo"
});

const EFFECT_NAME_KEYS = Object.freeze({
  Frightened: "PF2E_CREATURE_FORGE.Effect.Frightened1",
  Hampered: "PF2E_CREATURE_FORGE.Effect.Hampered10",
  "Off-Guard": "PF2E_CREATURE_FORGE.Effect.OffGuard"
});

const AFFLICTION_STAGE_DESCRIPTION_KEYS = Object.freeze({
  [`${MODULE_ID}.affliction.predator-venom`]: [
    ["The venom weakens the victim.", "PF2E_CREATURE_FORGE.Affliction.PredatorVenom.Stage1.Description"],
    ["The venom severely weakens the victim.", "PF2E_CREATURE_FORGE.Affliction.PredatorVenom.Stage2.Description"]
  ],
  [`${MODULE_ID}.affliction.grave-rot`]: [
    ["Necrotic weakness spreads through the body.", "PF2E_CREATURE_FORGE.Affliction.GraveRot.Stage1.Description"],
    ["The victim's strength withers further.", "PF2E_CREATURE_FORGE.Affliction.GraveRot.Stage2.Description"]
  ],
  [`${MODULE_ID}.affliction.spore-fever`]: [
    ["Spores irritate the victim's senses.", "PF2E_CREATURE_FORGE.Affliction.SporeFever.Stage1.Description"],
    ["The infection blooms aggressively.", "PF2E_CREATURE_FORGE.Affliction.SporeFever.Stage2.Description"]
  ],
  [`${MODULE_ID}.affliction.infernal-taint`]: [
    ["Unholy influence clouds the victim's resolve.", "PF2E_CREATURE_FORGE.Affliction.InfernalTaint.Stage1.Description"],
    ["The corruption deepens.", "PF2E_CREATURE_FORGE.Affliction.InfernalTaint.Stage2.Description"]
  ]
});

function resourceId(resource) {
  return String(resource?.contentId ?? resource?.id ?? resource?.definition?.id ?? "");
}

function localizeNestedEffectName(effect, topFallback, topLocalized) {
  if (!effect || typeof effect !== "object") return;
  const current = String(effect.name ?? "");
  if (!current) return;
  if (current === topFallback) {
    effect.name = topLocalized;
    return;
  }
  const key = EFFECT_NAME_KEYS[current];
  if (key) effect.name = localize(key, current);
}

export function localizeAuraResourceDefinition(resource) {
  const definition = deepClone(resource?.definition ?? {});
  const id = resourceId(resource);
  const fallbackName = AURA_DEFAULT_NAMES[id] ?? String(definition.name ?? resource?.name ?? resource?.id ?? "Aura");
  const localizedName = localize(resource?.nameKey, fallbackName);
  definition.name = localizedName;
  if (!String(definition.description ?? "").trim() && resource?.descriptionKey) {
    definition.description = localize(resource.descriptionKey, "");
  }

  if (AURA_DEFAULT_NAMES[id]) {
    for (const presence of definition.presenceEffects ?? []) {
      if (!String(presence.name ?? "").trim() || presence.name === fallbackName) presence.name = localizedName;
      localizeNestedEffectName(presence.effect, fallbackName, localizedName);
    }
    for (const trigger of definition.triggers ?? []) {
      if (!String(trigger.name ?? "").trim() || trigger.name === fallbackName) trigger.name = localizedName;
      for (const effect of Object.values(trigger.outcomes ?? {})) localizeNestedEffectName(effect, fallbackName, localizedName);
    }
  }
  return definition;
}

export function localizeAfflictionResourceDefinition(resource) {
  const definition = deepClone(resource?.definition ?? {});
  const id = resourceId(resource);
  const localizedName = localize(resource?.nameKey, definition.name ?? resource?.name ?? resource?.id ?? "Affliction");
  definition.name = localizedName;
  if (!String(definition.description ?? "").trim() && resource?.descriptionKey) {
    definition.description = localize(resource.descriptionKey, "");
  }

  const stageKeys = AFFLICTION_STAGE_DESCRIPTION_KEYS[id] ?? [];
  for (const [index, stage] of (definition.stages ?? []).entries()) {
    if (!String(stage.name ?? "").trim() || /^stage\s+\d+$/i.test(String(stage.name))) {
      stage.name = format("PF2E_CREATURE_FORGE.Affliction.Stage", { number: stage.number }, `Stage ${stage.number}`);
    }
    const [fallbackDescription, descriptionKey] = stageKeys[index] ?? [];
    if (descriptionKey && (!String(stage.description ?? "").trim() || stage.description === fallbackDescription)) {
      stage.description = localize(descriptionKey, fallbackDescription);
    }
    const effectName = String(stage.effect?.name ?? "");
    if (stage.effect && (!effectName || ["Venom", "Grave Rot", "Spore Fever", "Infernal Taint"].includes(effectName))) {
      stage.effect.name = localizedName;
    }
  }
  return definition;
}
