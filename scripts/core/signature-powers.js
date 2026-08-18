import { MODULE_ID } from "../constants.js";
import { deepClone } from "./clone.js";
import { listAbilityCandidates, materializeAbility } from "./ability-engine.js";
import { SPELL_DC_TABLE, assertCreatureLevel, resolveRankValue } from "./tables.js";

// GM Core limited-use area damage for two-action abilities such as breath weapons.
// Levels -1..24 map to 1d6, 1d10, then 2d6..25d6.
const LIMITED_AREA_DAMAGE = Object.freeze({
  [-1]: "1d6",
  0: "1d10",
  ...Object.fromEntries(Array.from({ length: 24 }, (_, index) => [index + 1, `${index + 2}d6`]))
});

const ELEMENT_PROFILES = Object.freeze({
  fire: { damageType: "fire", save: "reflex", shapes: ["cone", "line"], trait: "fire" },
  cold: { damageType: "cold", save: "reflex", shapes: ["cone"], trait: "cold" },
  electricity: { damageType: "electricity", save: "reflex", shapes: ["line"], trait: "electricity" },
  acid: { damageType: "acid", save: "reflex", shapes: ["line", "cone"], trait: "acid" },
  poison: { damageType: "poison", save: "fortitude", shapes: ["cone"], trait: "poison" },
  // Generic affinity fallbacks used by Creature Forge when a creature has an
  // elemental subtype but no more specific energy subtype.
  air: { damageType: "electricity", save: "reflex", shapes: ["line"], trait: "electricity" },
  water: { damageType: "cold", save: "reflex", shapes: ["cone"], trait: "cold" },
  earth: { damageType: "bludgeoning", save: "reflex", shapes: ["cone"], trait: null },
  metal: { damageType: "piercing", save: "reflex", shapes: ["line"], trait: null },
  wood: { damageType: "poison", save: "fortitude", shapes: ["cone"], trait: "poison" }
});

const ELEMENT_AFFINITY_ORDER = Object.freeze([
  "fire", "cold", "electricity", "acid", "poison", "air", "water", "earth", "metal", "wood"
]);

const SIGNATURE_CHANCE = Object.freeze({ conservative: 0.65, balanced: 0.85, experimental: 0.95 });

export function limitedAreaDamageFormula(level) {
  return LIMITED_AREA_DAMAGE[assertCreatureLevel(level)];
}

function resolveAffinity(subtypes = [], { allowPoison = true } = {}) {
  const values = new Set((subtypes ?? []).map(String));
  return ELEMENT_AFFINITY_ORDER.find((slug) => values.has(slug) && (allowPoison || slug !== "poison")) ?? null;
}

export function resolveDragonBreathAffinity(subtypes = []) {
  return resolveAffinity(subtypes, { allowPoison: true });
}

export function resolveDragonBreathProfile(subtypes = []) {
  const affinity = resolveDragonBreathAffinity(subtypes);
  return affinity ? { affinity, ...deepClone(ELEMENT_PROFILES[affinity]) } : null;
}

export function resolveElementalSignatureProfile(subtypes = []) {
  const affinity = resolveAffinity(subtypes, { allowPoison: false });
  return affinity ? { affinity, ...deepClone(ELEMENT_PROFILES[affinity]) } : null;
}

function breathDistanceFeet(level, shape) {
  if (shape === "line") return level >= 12 ? 60 : 30;
  return level >= 12 ? 30 : 15;
}

function generatedEffect({ id, name, nameKey, descriptionKey, img, components, source, tags = [], duration = null }) {
  return {
    id,
    contentId: id,
    name,
    nameKey,
    descriptionKey,
    definition: {
      schemaVersion: 2,
      id,
      name,
      description: "",
      img,
      duration: duration ?? { value: 0, unit: "rounds", expiry: "turn-end" },
      components: deepClone(components),
      application: { targetType: "actor", stacking: "replace", incompatibilityMode: "warn" },
      metadata: {
        originModule: MODULE_ID,
        originFeature: "signature-power",
        tags: ["creature-forge", "signature", ...tags]
      }
    },
    source: deepClone(source ?? {}),
    locked: false
  };
}

function generatedBreathEffect({ abilityId, formula, damageType, source }) {
  const id = `${MODULE_ID}.generated.${abilityId}.damage`;
  return generatedEffect({
    id,
    name: "Breath Weapon Damage",
    nameKey: "PF2E_CREATURE_FORGE.Signature.DragonBreath.DamageEffect.Name",
    descriptionKey: "PF2E_CREATURE_FORGE.Signature.DragonBreath.DamageEffect.Description",
    img: "icons/magic/fire/blast-jet-stream-splash.webp",
    components: [{ type: "damage", formula, damageType }],
    source,
    tags: ["dragon-breath", damageType]
  });
}

function generatedTrollRegenerationEffect({ abilityId, level, source }) {
  const value = Math.max(3, Math.min(20, 3 + Math.floor(Math.max(0, level) / 2)));
  const id = `${MODULE_ID}.generated.${abilityId}.regeneration`;
  return {
    value,
    resource: generatedEffect({
      id,
      name: "Regeneration",
      nameKey: "PF2E_CREATURE_FORGE.Signature.TrollRegeneration.Effect.Name",
      descriptionKey: "PF2E_CREATURE_FORGE.Signature.TrollRegeneration.Effect.Description",
      img: "icons/magic/life/heart-cross-strong-green.webp",
      components: [{ type: "regeneration", value, deactivatedBy: ["acid", "fire"] }],
      source,
      tags: ["troll-regeneration", "regeneration"],
      duration: { value: -1, unit: "unlimited", expiry: null }
    })
  };
}

function generatedVampireTempHpEffect({ abilityId, level, source }) {
  const value = Math.max(3, 3 + Math.floor(Math.max(0, level) / 2));
  const id = `${MODULE_ID}.generated.${abilityId}.temp-hp`;
  return {
    value,
    resource: generatedEffect({
      id,
      name: "Stolen Vitality",
      nameKey: "PF2E_CREATURE_FORGE.Signature.VampiricDrain.TempHpEffect.Name",
      descriptionKey: "PF2E_CREATURE_FORGE.Signature.VampiricDrain.TempHpEffect.Description",
      img: "icons/magic/unholy/projectile-smoke-trail-pink.webp",
      components: [{ type: "temporaryHitPoints", value }],
      source,
      tags: ["vampiric-drain", "temporary-hit-points", "void"],
      duration: { value: 1, unit: "minutes", expiry: "turn-end" }
    })
  };
}

function generatedPhoenixBurstEffect({ abilityId, level, source }) {
  const adjustedLevel = Math.max(-1, assertCreatureLevel(level) - 2);
  const formula = limitedAreaDamageFormula(adjustedLevel);
  const id = `${MODULE_ID}.generated.${abilityId}.rebirth-burst`;
  return {
    formula,
    resource: generatedEffect({
      id,
      name: "Rebirth Flame",
      nameKey: "PF2E_CREATURE_FORGE.Signature.PhoenixRebirth.DamageEffect.Name",
      descriptionKey: "PF2E_CREATURE_FORGE.Signature.PhoenixRebirth.DamageEffect.Description",
      img: "icons/magic/fire/explosion-fireball-large-orange.webp",
      components: [{ type: "damage", formula, damageType: "fire" }],
      source,
      tags: ["phoenix-rebirth", "fire"]
    })
  };
}

function generatedElementalRetaliationEffect({ abilityId, level, damageType, source }) {
  const dice = Math.max(1, Math.min(8, 1 + Math.floor(Math.max(0, level) / 4)));
  const formula = `${dice}d6`;
  const id = `${MODULE_ID}.generated.${abilityId}.${damageType}.damage`;
  return {
    formula,
    resource: generatedEffect({
      id,
      name: "Elemental Retaliation Damage",
      nameKey: "PF2E_CREATURE_FORGE.Signature.ElementalRetaliation.DamageEffect.Name",
      descriptionKey: "PF2E_CREATURE_FORGE.Signature.ElementalRetaliation.DamageEffect.Description",
      img: "icons/magic/defensive/shield-barrier-flaming-diamond-orange.webp",
      components: [{ type: "damage", formula, damageType }],
      source,
      tags: ["elemental-retaliation", damageType]
    })
  };
}

function signatureChance(entry, variation) {
  const configured = entry?.signature?.chance;
  if (typeof configured === "number") return Math.max(0, Math.min(1, configured));
  if (configured && typeof configured === "object") {
    const value = Number(configured[variation] ?? configured.balanced);
    if (Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  }
  return SIGNATURE_CHANCE[variation] ?? SIGNATURE_CHANCE.balanced;
}

function materializeDragonBreath(entry, { level, subtypes, random }) {
  const profile = resolveDragonBreathProfile(subtypes);
  if (!profile) return null;
  const shape = random.fork("shape").pick(profile.shapes) ?? profile.shapes[0];
  const formula = limitedAreaDamageFormula(level);
  const dc = resolveRankValue(SPELL_DC_TABLE, level, "high");
  const materialized = materializeAbility(entry, 0);
  const effect = generatedBreathEffect({ abilityId: `${materialized.family}.${profile.affinity}`, formula, damageType: profile.damageType, source: materialized.source });

  materialized.signature = {
    kind: "dragon-breath",
    affinity: profile.affinity,
    priority: Number(entry.signature?.priority ?? 100),
    budgetBonus: Number(entry.signature?.budgetBonus ?? materialized.powerCost ?? 3)
  };
  materialized.mechanics = {
    damage: { formula, type: profile.damageType },
    save: { type: profile.save, dc, basic: true },
    area: { shape, distanceFeet: breathDistanceFeet(level, shape) },
    recharge: { type: "rounds", formula: "1d4" }
  };
  materialized.traits = [...new Set([...(materialized.traits ?? []), ...(profile.trait ? [profile.trait] : [])])];
  materialized.tags = [...new Set([...(materialized.tags ?? []), profile.affinity, profile.damageType, "signature"] )];
  materialized.generatedEffects = [effect];
  materialized.applications = [{
    type: "effect",
    ref: effect.id,
    target: "failed-save-targets",
    timing: "failed-save",
    note: "Full damage. Basic-save half/double adjudication remains with the GM."
  }];
  return materialized;
}

function materializeTrollRegeneration(entry, { level }) {
  const materialized = materializeAbility(entry, 0);
  const generated = generatedTrollRegenerationEffect({ abilityId: materialized.family, level, source: materialized.source });
  materialized.signature = {
    kind: "troll-regeneration",
    priority: Number(entry.signature?.priority ?? 110),
    budgetBonus: Number(entry.signature?.budgetBonus ?? materialized.powerCost ?? 3)
  };
  materialized.mechanics = {
    regeneration: { value: generated.value, deactivatedBy: ["acid", "fire"] }
  };
  materialized.generatedEffects = [generated.resource];
  materialized.applications = [{ type: "effect", ref: generated.resource.id, target: "self", timing: "always" }];
  materialized.tags = [...new Set([...(materialized.tags ?? []), "regeneration", "signature"] )];
  return materialized;
}

function materializeVampiricDrain(entry, { level }) {
  const materialized = materializeAbility(entry, 0);
  const generated = generatedVampireTempHpEffect({ abilityId: materialized.family, level, source: materialized.source });
  const drainedRef = `${MODULE_ID}.effect.drained-1`;
  materialized.signature = {
    kind: "vampiric-drain",
    priority: Number(entry.signature?.priority ?? 110),
    budgetBonus: Number(entry.signature?.budgetBonus ?? materialized.powerCost ?? 3)
  };
  materialized.mechanics = { vampiricDrain: { drained: 1, temporaryHitPoints: generated.value } };
  materialized.generatedEffects = [generated.resource];
  materialized.applications = [
    { type: "effect", ref: drainedRef, target: "target", timing: "on-hit" },
    { type: "effect", ref: generated.resource.id, target: "self", timing: "on-hit" }
  ];
  materialized.tags = [...new Set([...(materialized.tags ?? []), "void", "drain", "signature"] )];
  return materialized;
}

function materializeHydraHeads(entry, { level }) {
  const materialized = materializeAbility(entry, 0);
  const heads = Math.max(3, Math.min(8, 3 + Math.floor(Math.max(0, level) / 4)));
  const reactions = Math.max(1, Math.min(3, 1 + Math.floor((heads - 3) / 2)));
  materialized.signature = {
    kind: "hydra-heads",
    priority: Number(entry.signature?.priority ?? 120),
    budgetBonus: Number(entry.signature?.budgetBonus ?? materialized.powerCost ?? 3)
  };
  materialized.mechanics = { heads: { count: heads, reactionsPerRound: reactions, regrowth: true } };
  materialized.tags = [...new Set([...(materialized.tags ?? []), "many-heads", "reaction", "signature"] )];
  return materialized;
}

function materializePhoenixRebirth(entry, { level }) {
  const materialized = materializeAbility(entry, 0);
  const generated = generatedPhoenixBurstEffect({ abilityId: materialized.family, level, source: materialized.source });
  const dc = resolveRankValue(SPELL_DC_TABLE, level, "high");
  const distanceFeet = level >= 14 ? 30 : 15;
  materialized.signature = {
    kind: "phoenix-rebirth",
    priority: Number(entry.signature?.priority ?? 130),
    budgetBonus: Number(entry.signature?.budgetBonus ?? materialized.powerCost ?? 4)
  };
  materialized.mechanics = {
    rebirth: { once: true, delay: "1d4", hitPointsPercent: 50 },
    damage: { formula: generated.formula, type: "fire" },
    save: { type: "reflex", dc, basic: true },
    area: { shape: "burst", distanceFeet }
  };
  materialized.generatedEffects = [generated.resource];
  materialized.applications = [{ type: "effect", ref: generated.resource.id, target: "failed-save-targets", timing: "rebirth" }];
  materialized.traits = [...new Set([...(materialized.traits ?? []), "fire"] )];
  materialized.tags = [...new Set([...(materialized.tags ?? []), "fire", "rebirth", "signature"] )];
  return materialized;
}

function materializeElementalRetaliation(entry, { level, subtypes }) {
  const profile = resolveElementalSignatureProfile(subtypes);
  if (!profile) return null;
  const materialized = materializeAbility(entry, 0);
  const generated = generatedElementalRetaliationEffect({ abilityId: materialized.family, level, damageType: profile.damageType, source: materialized.source });
  const dc = resolveRankValue(SPELL_DC_TABLE, level, "moderate");
  materialized.signature = {
    kind: "elemental-retaliation",
    affinity: profile.affinity,
    priority: Number(entry.signature?.priority ?? 80),
    budgetBonus: Number(entry.signature?.budgetBonus ?? materialized.powerCost ?? 2)
  };
  materialized.mechanics = {
    damage: { formula: generated.formula, type: profile.damageType },
    save: { type: profile.save, dc, basic: true },
    area: { shape: "emanation", distanceFeet: level >= 12 ? 15 : 10 }
  };
  materialized.generatedEffects = [generated.resource];
  materialized.applications = [{ type: "effect", ref: generated.resource.id, target: "failed-save-targets", timing: "trigger" }];
  materialized.traits = [...new Set([...(materialized.traits ?? []), ...(profile.trait ? [profile.trait] : [])])];
  materialized.tags = [...new Set([...(materialized.tags ?? []), profile.affinity, profile.damageType, "signature"] )];
  return materialized;
}

function materializeSignature(entry, context) {
  switch (entry.signature?.kind) {
    case "dragon-breath": return materializeDragonBreath(entry, context);
    case "troll-regeneration": return materializeTrollRegeneration(entry, context);
    case "vampiric-drain": return materializeVampiricDrain(entry, context);
    case "hydra-heads": return materializeHydraHeads(entry, context);
    case "phoenix-rebirth": return materializePhoenixRebirth(entry, context);
    case "elemental-retaliation": return materializeElementalRetaliation(entry, context);
    default: return null;
  }
}

export function resolveSignaturePlan({ request, registry, level, roleId, category, subtypes, random, force = false }) {
  if (request.abilities?.mode === "off") return { ability: null, bonus: 0, diagnostics: [] };
  const candidates = listAbilityCandidates({ request, registry, level, roleId, category, subtypes })
    .filter((entry) => entry.signature?.kind);
  if (!candidates.length) return { ability: null, bonus: 0, diagnostics: [] };

  const eligible = candidates.map((entry) => ({
    entry,
    priority: Number(entry.signature?.priority ?? 0)
  })).filter(({ entry }) => {
    if (entry.signature?.kind === "dragon-breath") return Boolean(resolveDragonBreathProfile(subtypes));
    if (entry.signature?.kind === "elemental-retaliation") return Boolean(resolveElementalSignatureProfile(subtypes));
    return true;
  });
  if (!eligible.length) return { ability: null, bonus: 0, diagnostics: [] };

  // Signature families with a stronger semantic claim win over generic families.
  // Randomness is retained between equally-prioritized candidates.
  const highestPriority = Math.max(...eligible.map((candidate) => candidate.priority));
  const top = eligible.filter((candidate) => candidate.priority === highestPriority);
  const picked = random.fork("pick").pick(top);
  if (!picked) return { ability: null, bonus: 0, diagnostics: [] };

  const variation = request.generation?.variation ?? "balanced";
  const chance = signatureChance(picked.entry, variation);
  if (!force && !random.fork("chance").chance(chance)) return { ability: null, bonus: 0, diagnostics: [] };

  const materialized = materializeSignature(deepClone(picked.entry), { level, subtypes, random: random.fork("materialize") });
  if (!materialized) return { ability: null, bonus: 0, diagnostics: [] };
  const bonus = request.abilities?.powerBudget === "auto" ? Number(materialized.signature?.budgetBonus ?? materialized.powerCost ?? 0) : 0;
  return { ability: materialized, bonus, diagnostics: [] };
}
