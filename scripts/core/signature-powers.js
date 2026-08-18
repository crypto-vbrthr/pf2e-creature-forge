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

const BREATH_PROFILES = Object.freeze({
  fire: { damageType: "fire", save: "reflex", shapes: ["cone", "line"], trait: "fire" },
  cold: { damageType: "cold", save: "reflex", shapes: ["cone"], trait: "cold" },
  electricity: { damageType: "electricity", save: "reflex", shapes: ["line"], trait: "electricity" },
  acid: { damageType: "acid", save: "reflex", shapes: ["line", "cone"], trait: "acid" },
  poison: { damageType: "poison", save: "fortitude", shapes: ["cone"], trait: "poison" },
  // Generic affinity fallbacks used by Creature Forge when a dragon has an
  // elemental subtype but no more specific breath damage subtype.
  air: { damageType: "electricity", save: "reflex", shapes: ["line"], trait: "electricity" },
  water: { damageType: "cold", save: "reflex", shapes: ["cone"], trait: "cold" },
  earth: { damageType: "bludgeoning", save: "reflex", shapes: ["cone"], trait: null },
  metal: { damageType: "piercing", save: "reflex", shapes: ["line"], trait: null },
  wood: { damageType: "poison", save: "fortitude", shapes: ["cone"], trait: "poison" }
});

const BREATH_AFFINITY_ORDER = Object.freeze([
  "fire", "cold", "electricity", "acid", "poison", "air", "water", "earth", "metal", "wood"
]);

const SIGNATURE_CHANCE = Object.freeze({ conservative: 0.65, balanced: 0.85, experimental: 0.95 });

export function limitedAreaDamageFormula(level) {
  return LIMITED_AREA_DAMAGE[assertCreatureLevel(level)];
}

export function resolveDragonBreathAffinity(subtypes = []) {
  const values = new Set((subtypes ?? []).map(String));
  return BREATH_AFFINITY_ORDER.find((slug) => values.has(slug)) ?? null;
}

export function resolveDragonBreathProfile(subtypes = []) {
  const affinity = resolveDragonBreathAffinity(subtypes);
  return affinity ? { affinity, ...deepClone(BREATH_PROFILES[affinity]) } : null;
}

function breathDistanceFeet(level, shape) {
  if (shape === "line") return level >= 12 ? 60 : 30;
  return level >= 12 ? 30 : 15;
}

function generatedBreathEffect({ abilityId, formula, damageType, source }) {
  const id = `${MODULE_ID}.generated.${abilityId}.damage`;
  return {
    id,
    contentId: id,
    name: "Breath Weapon Damage",
    nameKey: "PF2E_CREATURE_FORGE.Signature.DragonBreath.DamageEffect.Name",
    descriptionKey: "PF2E_CREATURE_FORGE.Signature.DragonBreath.DamageEffect.Description",
    definition: {
      schemaVersion: 2,
      id,
      name: "Breath Weapon Damage",
      description: "",
      img: "icons/magic/fire/blast-jet-stream-splash.webp",
      duration: { value: 0, unit: "rounds", expiry: "turn-end" },
      components: [{ type: "damage", formula, damageType }],
      application: { targetType: "actor", stacking: "replace", incompatibilityMode: "warn" },
      metadata: {
        originModule: MODULE_ID,
        originFeature: "signature-power",
        tags: ["creature-forge", "signature", "dragon-breath", damageType]
      }
    },
    source: deepClone(source ?? {}),
    locked: false
  };
}

export function resolveSignaturePlan({ request, registry, level, roleId, category, subtypes, random, force = false }) {
  if (request.abilities?.mode === "off") return { ability: null, bonus: 0, diagnostics: [] };
  const candidates = listAbilityCandidates({ request, registry, level, roleId, category, subtypes })
    .filter((entry) => entry.signature?.kind);
  if (!candidates.length) return { ability: null, bonus: 0, diagnostics: [] };

  const variation = request.generation?.variation ?? "balanced";
  const eligible = [];
  for (const entry of candidates) {
    if (entry.signature?.kind === "dragon-breath") {
      const profile = resolveDragonBreathProfile(subtypes);
      if (!profile) continue;
      eligible.push({ entry, profile });
    }
  }
  if (!eligible.length) return { ability: null, bonus: 0, diagnostics: [] };

  const chance = SIGNATURE_CHANCE[variation] ?? SIGNATURE_CHANCE.balanced;
  if (!force && !random.fork("chance").chance(chance)) return { ability: null, bonus: 0, diagnostics: [] };

  const picked = random.fork("pick").pick(eligible);
  if (!picked) return { ability: null, bonus: 0, diagnostics: [] };
  const entry = deepClone(picked.entry);
  const profile = picked.profile;
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

  const bonus = request.abilities?.powerBudget === "auto" ? Number(materialized.signature.budgetBonus ?? materialized.powerCost ?? 0) : 0;
  return { ability: materialized, bonus, diagnostics: [] };
}
