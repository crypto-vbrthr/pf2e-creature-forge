import { MODULE_VERSION } from "../constants.js";
import { createRandomSeed, SeededRandom } from "./rng.js";
import { createEmptyBlueprint, createGenerationRequest } from "./schemas.js";
import { resolveRolePreset } from "./role-presets.js";
import {
  AC_TABLE, ATTACK_TABLE, HP_TABLE, PERCEPTION_TABLE, SAVE_TABLE,
  assertCreatureLevel, resolveAttackDamage, resolveAttributeValue, resolveHpRange, resolveRankValue
} from "./tables.js";
import { validateBlueprint, validateGenerationRequest } from "./validator.js";
import { deepClone } from "./clone.js";
import { resolveAttackNameKey } from "./attack-localization.js";
import { generateSkills } from "./skills.js";
import { generateMovement, generateSenses } from "./mobility.js";
import { calculateAffinityHpAdjustment, generateDefensiveAffinities } from "./defensive-affinities.js";
import { collectAbilityEffectResources, generateAbilities, rerollAbilitySlot, resolveAbilityPowerBudget } from "./ability-engine.js";
import { generateSpecialFeatures, rerollSpecialFeature } from "./special-features.js";
import { assignAfflictionDeliveries } from "./affliction-delivery.js";
import { generateSpellcasting, rerollSpellcasting, rerollSpellSlot } from "./spellcasting.js";

const SAVE_NAMES = Object.freeze(["fortitude", "reflex", "will"]);
const ABILITY_NAMES = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);
const ATTACK_RANKS = Object.freeze(["low", "moderate", "high", "extreme"]);
const DAMAGE_RANKS = Object.freeze(["low", "moderate", "high", "extreme"]);

const CATEGORY_ATTACK_FORMS = Object.freeze({
  animal: [
    { accurate: ["Claw", "slashing"], heavy: ["Jaws", "piercing"] },
    { accurate: ["Talons", "slashing"], heavy: ["Bite", "piercing"] }
  ],
  beast: [
    { accurate: ["Claw", "slashing"], heavy: ["Jaws", "piercing"] },
    { accurate: ["Horn", "piercing"], heavy: ["Slam", "bludgeoning"] }
  ],
  dragon: [
    { accurate: ["Claw", "slashing"], heavy: ["Jaws", "piercing"] },
    { accurate: ["Tail", "bludgeoning"], heavy: ["Jaws", "piercing"] }
  ],
  aberration: [
    { accurate: ["Tentacle", "bludgeoning"], heavy: ["Maw", "piercing"] },
    { accurate: ["Claw", "slashing"], heavy: ["Slam", "bludgeoning"] }
  ],
  celestial: [{ accurate: ["Claw", "slashing"], heavy: ["Slam", "bludgeoning"] }],
  fiend: [{ accurate: ["Claw", "slashing"], heavy: ["Jaws", "piercing"] }],
  fey: [{ accurate: ["Claw", "slashing"], heavy: ["Thorn", "piercing"] }],
  fungus: [{ accurate: ["Tendril", "bludgeoning"], heavy: ["Spore Lash", "bludgeoning"] }],
  plant: [{ accurate: ["Tendril", "bludgeoning"], heavy: ["Thorn", "piercing"] }],
  ooze: [{ accurate: ["Pseudopod", "bludgeoning"], heavy: ["Slam", "bludgeoning"] }],
  undead: [
    { accurate: ["Claw", "slashing"], heavy: ["Jaws", "piercing"] },
    { accurate: ["Grasp", "bludgeoning"], heavy: ["Slam", "bludgeoning"] }
  ],
  construct: [{ accurate: ["Fist", "bludgeoning"], heavy: ["Slam", "bludgeoning"] }],
  elemental: [{ accurate: ["Elemental Strike", "bludgeoning"], heavy: ["Slam", "bludgeoning"] }],
  giant: [{ accurate: ["Fist", "bludgeoning"], heavy: ["Slam", "bludgeoning"] }],
  humanoid: [{ accurate: ["Quick Strike", "slashing"], heavy: ["Heavy Strike", "bludgeoning"] }],
  astral: [{ accurate: ["Force Touch", "force"], heavy: ["Slam", "force"] }],
  ethereal: [{ accurate: ["Ethereal Touch", "force"], heavy: ["Slam", "force"] }],
  monitor: [{ accurate: ["Claw", "slashing"], heavy: ["Slam", "bludgeoning"] }]
});

const ELEMENTAL_DAMAGE_BY_SUBTYPE = Object.freeze({
  acid: "acid",
  cold: "cold",
  electricity: "electricity",
  fire: "fire"
});

function resolveRequestedRank(requested, fallback) {
  return requested && requested !== "role" ? requested : fallback;
}

function sourceIdsForType(request, type) {
  if (type === "category") return request?.sources?.categories ?? [];
  if (type === "subtype") return request?.sources?.subtypes ?? [];
  return [];
}

function resolveTrait(registry, type, value, request = null) {
  const entry = typeof registry?.resolve === "function"
    ? registry.resolve(type, value, { compendiumIds: sourceIdsForType(request, type) })
    : registry?.list(type).find((candidate) => candidate.slug === value || candidate.id === value);
  return entry?.trait ?? entry?.slug ?? value;
}

function shiftRank(rank, delta, allowed) {
  const index = allowed.indexOf(rank);
  if (index < 0) return rank;
  return allowed[Math.max(0, Math.min(allowed.length - 1, index + delta))];
}

function normalizeAbilityRank(level, rank) {
  if (rank === "extreme" && level < 1) return "high";
  return rank;
}

function resolveAbilityStatistics(request, role, level, random) {
  const result = {};
  for (const ability of ABILITY_NAMES) {
    const requested = request.attributes?.[ability] ?? "role";
    let rank = normalizeAbilityRank(level, resolveRequestedRank(requested, role.abilities?.[ability] ?? "moderate"));
    let value;

    if (ability === "int" && requested === "role" && request.identity.subtypes.includes("mindless")) {
      rank = "terrible";
      value = -5;
    } else if (ability === "int" && requested === "role" && request.identity.category === "animal") {
      rank = "terrible";
      value = random.fork("animal-intelligence").pick([-5, -4]);
    } else {
      value = resolveAttributeValue(level, rank);
    }

    result[ability] = { rank, value };
  }
  return result;
}

function resolveDamageType(request, attackKind, profile, form, random) {
  const explicit = String(request.offense?.damageType ?? "auto").trim().toLowerCase();
  if (explicit && explicit !== "auto") return explicit;

  const elemental = request.identity.subtypes
    .map((slug) => ELEMENTAL_DAMAGE_BY_SUBTYPE[slug])
    .filter(Boolean);
  if (elemental.length && (request.identity.category === "elemental" || request.identity.category === "dragon" || request.identity.category === "aberration")) {
    const useElement = request.generation.variation === "experimental" ? 0.7 : 0.4;
    if (random.chance(useElement)) return random.pick(elemental);
  }

  if (attackKind === "ranged") return profile === "heavy" ? "piercing" : "piercing";
  return form?.[1] ?? "bludgeoning";
}

function chooseAttackForms(request, random) {
  const options = CATEGORY_ATTACK_FORMS[request.identity.category] ?? CATEGORY_ATTACK_FORMS.humanoid;
  return random.pick(options) ?? options[0];
}

function resolveAttackKind(request, role) {
  const kind = request.offense?.kind;
  return kind && kind !== "role" ? kind : (role.offense?.kind ?? "melee");
}

function resolveBaseOffense(request, role) {
  return {
    attack: resolveRequestedRank(request.offense?.attack, role.offense?.attack ?? "moderate"),
    damage: resolveRequestedRank(request.offense?.damage, role.offense?.damage ?? "moderate")
  };
}

function pairRanks(baseAttack, baseDamage, profile, level) {
  if (profile === "primary") return { attack: baseAttack, damage: baseDamage };
  if (profile === "accurate") {
    let attack = shiftRank(baseAttack, 1, ATTACK_RANKS);
    if (level < 11 && attack === "extreme" && baseAttack !== "extreme") attack = "high";
    return { attack, damage: shiftRank(baseDamage, -1, DAMAGE_RANKS) };
  }
  return {
    attack: shiftRank(baseAttack, -1, ATTACK_RANKS),
    damage: shiftRank(baseDamage, 1, DAMAGE_RANKS)
  };
}

function buildAttack({ request, role, level, random, profile, id, forms }) {
  const base = resolveBaseOffense(request, role);
  const ranks = pairRanks(base.attack, base.damage, profile, level);
  const kind = resolveAttackKind(request, role);
  const formProfile = profile === "primary" ? (random.chance(0.5) ? "accurate" : "heavy") : profile;
  const form = kind === "ranged"
    ? (formProfile === "heavy" ? ["Heavy Shot", "piercing"] : ["Precise Shot", "piercing"])
    : forms[formProfile];
  const damage = resolveAttackDamage(level, ranks.damage);
  const damageType = resolveDamageType(request, kind, formProfile, form, random.fork("damage-type"));
  const traits = [];
  if (kind === "melee") traits.push("unarmed");
  if (kind === "melee" && formProfile === "accurate") traits.push("agile");

  const name = form?.[0] ?? (kind === "ranged" ? "Projectile" : "Strike");

  return {
    id,
    profile,
    name,
    nameKey: resolveAttackNameKey(name),
    kind,
    category: kind === "melee" ? "unarmed" : "ranged",
    attack: {
      rank: ranks.attack,
      value: resolveRankValue(ATTACK_TABLE, level, ranks.attack)
    },
    damage: {
      rank: ranks.damage,
      formula: damage.formula,
      average: damage.average,
      type: damageType
    },
    traits: [...new Set(traits)],
    range: kind === "ranged" ? 60 : null,
    locked: false
  };
}

function generateAttacks(request, role, level, random) {
  const count = Math.max(0, Math.min(2, Number(request.options.attackCount ?? 1)));
  if (count === 0) return [];
  const forms = chooseAttackForms(request, random.fork("forms"));
  if (count === 1) {
    return [buildAttack({ request, role, level, random: random.fork("attack-1"), profile: "primary", id: "attack-1", forms })];
  }
  return [
    buildAttack({ request, role, level, random: random.fork("attack-1"), profile: "accurate", id: "attack-1", forms }),
    buildAttack({ request, role, level, random: random.fork("attack-2"), profile: "heavy", id: "attack-2", forms })
  ];
}

export class CreatureGenerator {
  constructor({ registry, spellSources = null }) {
    this.registry = registry;
    this.spellSources = spellSources;
  }

  generate(input = {}) {
    const request = createGenerationRequest(input);
    const requestValidation = validateGenerationRequest(request, { registry: this.registry });
    if (!requestValidation.valid) {
      const error = new Error(`Invalid CreatureGenerationRequest: ${requestValidation.errors.map((entry) => entry.message).join(" ")}`);
      error.validation = requestValidation;
      throw error;
    }

    const level = assertCreatureLevel(request.identity.level);
    const seed = request.generation.seed || createRandomSeed("creature");
    const random = new SeededRandom(seed);
    const role = resolveRolePreset(request.identity.role, random.fork("role"));

    const acRank = resolveRequestedRank(request.defenses.ac, role.ac);
    const hpRank = resolveRequestedRank(request.defenses.hp, role.hp);
    const perceptionRank = resolveRequestedRank(request.defenses.perception, role.perception);
    const saveRanks = Object.fromEntries(SAVE_NAMES.map((save) => [
      save,
      resolveRequestedRank(request.defenses.saves[save], role.saves[save])
    ]));

    const hpRange = resolveHpRange(level, hpRank);
    const affinities = generateDefensiveAffinities({
      request,
      registry: this.registry,
      level,
      random: random.fork("defenses.affinities"),
      hpRank
    });
    const effectiveRequest = deepClone(request);
    effectiveRequest.identity.subtypes = [...affinities.resolvedSubtypes];
    const hpBaseValue = random.fork("statistics.hp").int(hpRange.min, hpRange.max);
    const hpValue = Math.max(1, hpBaseValue + Number(affinities.hpAdjustment?.value ?? 0));
    const primaryTrait = resolveTrait(this.registry, "category", request.identity.category, request);
    const subtypeTraits = affinities.resolvedSubtypes.map((subtype) => resolveTrait(this.registry, "subtype", subtype, request));
    const traits = [...new Set([primaryTrait, ...subtypeTraits, ...(affinities.grantedTraits ?? [])].filter(Boolean))];
    const abilities = resolveAbilityStatistics(effectiveRequest, role, level, random.fork("statistics.abilities"));
    const skills = generateSkills(effectiveRequest, role, level, abilities, random.fork("statistics.skills"));
    const movement = generateMovement(effectiveRequest, role, level, random.fork("statistics.movement"));
    const senses = generateSenses(effectiveRequest, level, random.fork("statistics.senses"));
    const attacks = generateAttacks(effectiveRequest, role, level, random.fork("combat.attacks"));
    const totalSpecialBudget = resolveAbilityPowerBudget(effectiveRequest, request.identity.role);
    // Spellcasting is a primary concept feature, especially for the spellcaster
    // role. Resolve it before optional auras/afflictions so an incidental aura
    // cannot consume the entire budget and silently turn a caster into a mundane
    // creature. All three systems still spend from the same shared budget.
    const generatedSpellcasting = generateSpellcasting({
      request: effectiveRequest,
      registry: this.registry,
      spellSources: this.spellSources,
      level,
      roleId: request.identity.role,
      category: request.identity.category,
      subtypes: affinities.resolvedSubtypes,
      random: random.fork("spellcasting"),
      availableBudget: totalSpecialBudget
    });
    const generatedSpecialFeatures = generateSpecialFeatures({
      request: effectiveRequest,
      registry: this.registry,
      level,
      roleId: request.identity.role,
      category: request.identity.category,
      subtypes: affinities.resolvedSubtypes,
      random: random.fork("special-features"),
      budgetLimit: Math.max(0, totalSpecialBudget - generatedSpellcasting.spent)
    });
    const generatedAbilities = generateAbilities({
      request: effectiveRequest,
      registry: this.registry,
      level,
      roleId: request.identity.role,
      category: request.identity.category,
      subtypes: affinities.resolvedSubtypes,
      random: random.fork("abilities"),
      budgetLimitOverride: Math.max(0, generatedSpecialFeatures.budget.remaining)
    });

    const blueprint = createEmptyBlueprint();
    blueprint.metadata = {
      ...blueprint.metadata,
      generatorVersion: MODULE_VERSION,
      seed,
      variation: request.generation.variation,
      requestSnapshot: deepClone({ ...request, generation: { ...request.generation, seed } }),
      abilityBudget: deepClone(generatedAbilities.budget),
      specialFeatureBudget: {
        limit: totalSpecialBudget,
        spent: generatedAbilities.budget.spent + generatedSpecialFeatures.budget.spent + generatedSpellcasting.spent,
        remaining: Math.max(0, totalSpecialBudget - generatedAbilities.budget.spent - generatedSpecialFeatures.budget.spent - generatedSpellcasting.spent),
        abilitySpent: generatedAbilities.budget.spent,
        auraSpent: generatedSpecialFeatures.budget.auraSpent,
        afflictionSpent: generatedSpecialFeatures.budget.afflictionSpent,
        spellcastingSpent: generatedSpellcasting.spent
      }
    };
    blueprint.identity = {
      name: request.identity.name || "Creature",
      level,
      role: request.identity.role,
      category: request.identity.category,
      subtypes: [...request.identity.subtypes],
      resolvedSubtypes: [...affinities.resolvedSubtypes],
      traits,
      size: request.identity.size
    };
    blueprint.statistics = {
      abilities,
      ac: { rank: acRank, value: resolveRankValue(AC_TABLE, level, acRank) },
      hp: {
        rank: hpRank,
        value: hpValue,
        baseValue: hpBaseValue,
        adjustment: Number(affinities.hpAdjustment?.value ?? 0),
        range: hpRange
      },
      perception: { rank: perceptionRank, value: resolveRankValue(PERCEPTION_TABLE, level, perceptionRank) },
      senses,
      skills,
      saves: Object.fromEntries(SAVE_NAMES.map((save) => [save, {
        rank: saveRanks[save],
        value: resolveRankValue(SAVE_TABLE, level, saveRanks[save])
      }])),
      speed: movement
    };
    blueprint.defenses = {
      immunities: deepClone(affinities.immunities),
      resistances: deepClone(affinities.resistances),
      weaknesses: deepClone(affinities.weaknesses),
      hpAdjustment: deepClone(affinities.hpAdjustment)
    };
    blueprint.combat = {
      attacks,
      spellcasting: deepClone(generatedSpellcasting.spellcasting)
    };
    blueprint.abilities = deepClone(generatedAbilities.abilities);
    blueprint.resources.effects = deepClone(generatedAbilities.effects);
    blueprint.resources.auras = deepClone(generatedSpecialFeatures.auras);
    blueprint.resources.afflictions = deepClone(generatedSpecialFeatures.afflictions);
    assignAfflictionDeliveries(blueprint);
    blueprint.loot.policy = request.options.loot ?? "auto";
    blueprint.provenance = [
      {
        kind: "rules",
        source: "Pathfinder GM Core",
        section: "Building Creatures / Ability Modifiers",
        note: "Ability modifiers use the level/rank creature-building table and role road maps."
      },
      {
        kind: "rules",
        source: "Pathfinder GM Core",
        section: "Building Creatures / Attack Bonus and Attack Damage",
        note: "Strike bonuses and damage use the attack tables; two-strike profiles trade accuracy against damage."
      },
      {
        kind: "rules",
        source: "Pathfinder GM Core",
        section: "Building Creatures / Perception, Senses, Skills, and Speed",
        note: "Skills use the level/rank skill table; senses and movement are concept-sensitive suggestions with 25-foot land Speed as the humanlike baseline."
      },
      {
        kind: "rules",
        source: "Pathfinder GM Core",
        section: "Building Creatures / Immunities, Weaknesses, Resistances and Category Abilities",
        note: "Defensive affinities are derived from category and subtype definitions. Narrow resistances and weaknesses use the level table; broad resistances and weaknesses can adjust HP."
      },
      {
        kind: "engine",
        source: "PF2E Creature Forge",
        section: "Ability Engine",
        note: "Abilities are selected from registered content using category, subtype, role, level, synergy tags, source filters and seeded weighted randomness. Effect applications are stored as Effect Forge-compatible resources."
      },
      ...[...(request.sources?.categories ?? []), ...(request.sources?.subtypes ?? [])].map((source) => ({
        kind: "content-source",
        source,
        section: "Compendium Category/Subtype Discovery",
        note: "Selected creature compendium contributes discoverable categories and/or subtypes for this generation request."
      })),
      ...this.registry.resolveAbilityLibrarySelection(request.sources?.abilities ?? []).map((source) => ({
        kind: "content-source",
        source,
        section: "Ability Library",
        note: "Selected ability library contributes eligible abilities and their dependencies for this generation request."
      })),
      ...this.registry.resolveAuraLibrarySelection(request.sources?.auras ?? []).map((source) => ({
        kind: "content-source",
        source,
        section: "Aura Library",
        note: "Selected aura library contributes eligible optional auras for this generation request."
      })),
      ...this.registry.resolveAfflictionLibrarySelection(request.sources?.afflictions ?? []).map((source) => ({
        kind: "content-source",
        source,
        section: "Affliction Library",
        note: "Selected affliction library contributes eligible optional afflictions for this generation request."
      })),
      ...(this.spellSources?.resolveSelection?.(request.sources?.spells ?? []) ?? []).map((source) => ({
        kind: "content-source",
        source,
        section: "Spell Compendium",
        note: "Selected spell compendium contributes eligible spells for thematic spellcasting generation."
      })),
      ...(generatedSpellcasting.spellcasting?.length ? [{
        kind: "rules",
        source: "Pathfinder GM Core",
        section: "Building Creatures / Spell DC and Spell Attack Modifier",
        note: "Generated spell DC and spell attack modifiers use the creature-building spell statistics table."
      }] : []),
      ...affinities.hpAdjustment.reasons.map((reason) => ({
        kind: "balance",
        source: "PF2E Creature Forge",
        section: "Defensive Affinity HP Compensation",
        note: `${reason.kind}:${reason.type} adjusts HP by ${reason.adjustment >= 0 ? "+" : ""}${reason.adjustment}.`
      }))
    ];
    blueprint.diagnostics = [
      ...requestValidation.warnings,
      ...(generatedAbilities.diagnostics ?? []),
      ...(generatedSpecialFeatures.diagnostics ?? []),
      ...(generatedSpellcasting.diagnostics ?? []),
      ...validateBlueprint(blueprint).warnings
    ];
    return blueprint;
  }

  reroll(blueprint, options = {}) {
    const snapshot = blueprint?.metadata?.requestSnapshot;
    if (!snapshot) throw new Error("Blueprint does not contain a request snapshot and cannot be rerolled.");
    const scope = String(options.scope ?? "all");
    const newSeed = String(options.seed ?? createRandomSeed(`reroll-${scope}`));

    if (scope === "all") {
      return this.generate({ ...deepClone(snapshot), generation: { ...snapshot.generation, seed: newSeed } });
    }

    const next = deepClone(blueprint);
    next.metadata.seed = newSeed;
    next.metadata.rerollHistory ??= [];
    next.metadata.rerollHistory.push({ scope, previousSeed: blueprint.metadata.seed, seed: newSeed });
    next.metadata.requestSnapshot.generation.seed = newSeed;
    const random = new SeededRandom(newSeed);

    if (scope === "statistics.hp") {
      if (next.locks?.["statistics.hp"]) return next;
      const range = next.statistics.hp.range ?? resolveHpRange(next.identity.level, next.statistics.hp.rank);
      const baseValue = random.fork("statistics.hp").int(range.min, range.max);
      const adjustment = Number(next.defenses?.hpAdjustment?.value ?? next.statistics.hp?.adjustment ?? 0);
      next.statistics.hp.baseValue = baseValue;
      next.statistics.hp.adjustment = adjustment;
      next.statistics.hp.value = Math.max(1, baseValue + adjustment);
      next.diagnostics = validateBlueprint(next).warnings;
      return next;
    }

    const regenerated = () => this.generate({ ...deepClone(snapshot), generation: { ...snapshot.generation, seed: newSeed } });

    if (scope === "statistics.abilities") {
      if (next.locks?.["statistics.abilities"]) return next;
      next.statistics.abilities = regenerated().statistics.abilities;
      next.diagnostics = validateBlueprint(next).warnings;
      return next;
    }

    if (scope === "statistics.skills" || scope === "skills") {
      if (next.locks?.["statistics.skills"]) return next;
      const generated = regenerated();
      const locked = Object.fromEntries(Object.entries(next.statistics?.skills ?? {}).filter(([, skill]) => skill?.locked));
      next.statistics.skills = { ...generated.statistics.skills, ...locked };
      next.diagnostics = validateBlueprint(next).warnings;
      return next;
    }

    if (scope === "statistics.movement" || scope === "movement") {
      if (next.locks?.["statistics.movement"]) return next;
      next.statistics.speed = regenerated().statistics.speed;
      next.diagnostics = validateBlueprint(next).warnings;
      return next;
    }

    if (scope === "statistics.senses" || scope === "senses") {
      if (next.locks?.["statistics.senses"]) return next;
      const generated = regenerated();
      const lockedByType = new Map((next.statistics?.senses ?? []).filter((sense) => sense.locked).map((sense) => [sense.type, sense]));
      next.statistics.senses = generated.statistics.senses.map((sense) => lockedByType.get(sense.type) ?? sense);
      for (const [type, sense] of lockedByType) {
        if (!next.statistics.senses.some((entry) => entry.type === type)) next.statistics.senses.push(sense);
      }
      next.diagnostics = validateBlueprint(next).warnings;
      return next;
    }

    if (scope === "combat.attacks" || scope === "attacks") {
      if (next.locks?.["combat.attacks"]) return next;
      const generated = regenerated();
      const lockedById = new Map((next.combat?.attacks ?? []).filter((attack) => attack.locked).map((attack) => [attack.id, attack]));
      next.combat.attacks = generated.combat.attacks.map((attack) => lockedById.get(attack.id) ?? attack);
      assignAfflictionDeliveries(next);
      next.diagnostics = validateBlueprint(next).warnings;
      return next;
    }

    if (scope === "abilities") {
      if (next.locks?.abilities) return next;
      const preserved = (next.abilities ?? [])
        .map((ability, index) => ability?.locked ? { index, ability } : null)
        .filter(Boolean);
      const totalBudget = Number(next.metadata?.specialFeatureBudget?.limit ?? resolveAbilityPowerBudget(next.metadata.requestSnapshot, next.identity.role));
      const spellcastingSpent = Number(next.combat?.spellcasting?.[0]?.powerCost ?? 0);
      const featureSpent = Number(next.resources?.auras?.[0]?.powerCost ?? 0) + Number(next.resources?.afflictions?.[0]?.powerCost ?? 0) + spellcastingSpent;
      const result = generateAbilities({
        request: next.metadata.requestSnapshot,
        registry: this.registry,
        level: next.identity.level,
        roleId: next.identity.role,
        category: next.identity.category,
        subtypes: next.identity.resolvedSubtypes ?? next.identity.subtypes ?? [],
        random: random.fork("abilities"),
        preserve: preserved,
        budgetLimitOverride: Math.max(0, totalBudget - featureSpent)
      });
      next.abilities = result.abilities;
      next.resources.effects = collectAbilityEffectResources(next.abilities, this.registry, [
        ...(next.resources?.effects ?? []),
        ...(result.effects ?? [])
      ]);
      next.metadata.abilityBudget = deepClone(result.budget);
      assignAfflictionDeliveries(next);
      next.metadata.specialFeatureBudget = {
        ...(next.metadata.specialFeatureBudget ?? {}),
        spent: featureSpent + result.budget.spent,
        remaining: Math.max(0, totalBudget - featureSpent - result.budget.spent),
        abilitySpent: result.budget.spent,
        auraSpent: Number(next.resources?.auras?.[0]?.powerCost ?? 0),
        afflictionSpent: Number(next.resources?.afflictions?.[0]?.powerCost ?? 0),
        spellcastingSpent
      };
      next.diagnostics = [...(result.diagnostics ?? []), ...validateBlueprint(next).warnings];
      return next;
    }

    if (scope === "auras" || scope === "afflictions") {
      const kind = scope === "auras" ? "aura" : "affliction";
      if (next.locks?.[scope]) return next;
      const result = rerollSpecialFeature({
        request: next.metadata.requestSnapshot,
        registry: this.registry,
        blueprint: next,
        kind,
        random: random.fork(scope)
      });
      next.resources[scope] = result.feature ? [result.feature] : [];
      assignAfflictionDeliveries(next);
      const totalBudget = Number(next.metadata?.specialFeatureBudget?.limit ?? resolveAbilityPowerBudget(next.metadata.requestSnapshot, next.identity.role));
      const auraSpent = Number(next.resources?.auras?.[0]?.powerCost ?? 0);
      const afflictionSpent = Number(next.resources?.afflictions?.[0]?.powerCost ?? 0);
      const abilitySpent = Number(next.metadata?.abilityBudget?.spent ?? 0);
      const spellcastingSpent = Number(next.combat?.spellcasting?.[0]?.powerCost ?? 0);
      next.metadata.specialFeatureBudget = {
        limit: totalBudget,
        spent: auraSpent + afflictionSpent + abilitySpent + spellcastingSpent,
        remaining: Math.max(0, totalBudget - auraSpent - afflictionSpent - abilitySpent - spellcastingSpent),
        abilitySpent, auraSpent, afflictionSpent, spellcastingSpent
      };
      next.diagnostics = [...(result.diagnostics ?? []), ...validateBlueprint(next).warnings];
      return next;
    }

    if (scope === "special-features") {
      if (next.locks?.["special-features"]) return next;
      const totalBudget = Number(next.metadata?.specialFeatureBudget?.limit ?? resolveAbilityPowerBudget(next.metadata.requestSnapshot, next.identity.role));
      const abilitySpent = Number(next.metadata?.abilityBudget?.spent ?? 0);
      const spellcastingSpent = Number(next.combat?.spellcasting?.[0]?.powerCost ?? 0);
      const result = generateSpecialFeatures({
        request: next.metadata.requestSnapshot,
        registry: this.registry,
        level: next.identity.level,
        roleId: next.identity.role,
        category: next.identity.category,
        subtypes: next.identity.resolvedSubtypes ?? next.identity.subtypes ?? [],
        random: random.fork("special-features"),
        budgetLimit: Math.max(0, totalBudget - abilitySpent - spellcastingSpent),
        preserve: {
          aura: next.resources?.auras?.[0]?.locked ? next.resources.auras[0] : null,
          affliction: next.resources?.afflictions?.[0]?.locked ? next.resources.afflictions[0] : null
        }
      });
      next.resources.auras = result.auras;
      next.resources.afflictions = result.afflictions;
      assignAfflictionDeliveries(next);
      next.metadata.specialFeatureBudget = {
        limit: totalBudget,
        spent: abilitySpent + spellcastingSpent + result.budget.spent,
        remaining: Math.max(0, totalBudget - abilitySpent - spellcastingSpent - result.budget.spent),
        abilitySpent,
        auraSpent: result.budget.auraSpent,
        afflictionSpent: result.budget.afflictionSpent,
        spellcastingSpent
      };
      next.diagnostics = [...(result.diagnostics ?? []), ...validateBlueprint(next).warnings];
      return next;
    }

    if (scope.startsWith("ability:")) {
      const targetId = scope.slice("ability:".length);
      const result = rerollAbilitySlot({
        request: next.metadata.requestSnapshot,
        registry: this.registry,
        blueprint: next,
        targetId,
        random: random.fork(`ability-slot:${targetId}`)
      });
      next.abilities = result.abilities;
      next.resources.effects = result.effects;
      assignAfflictionDeliveries(next);
      next.metadata.abilityBudget = deepClone(result.budget);
      const totalBudget = Number(next.metadata?.specialFeatureBudget?.limit ?? resolveAbilityPowerBudget(next.metadata.requestSnapshot, next.identity.role));
      const auraSpent = Number(next.resources?.auras?.[0]?.powerCost ?? 0);
      const afflictionSpent = Number(next.resources?.afflictions?.[0]?.powerCost ?? 0);
      const spellcastingSpent = Number(next.combat?.spellcasting?.[0]?.powerCost ?? 0);
      next.metadata.specialFeatureBudget = {
        limit: totalBudget,
        spent: result.budget.spent + auraSpent + afflictionSpent + spellcastingSpent,
        remaining: Math.max(0, totalBudget - result.budget.spent - auraSpent - afflictionSpent - spellcastingSpent),
        abilitySpent: result.budget.spent, auraSpent, afflictionSpent, spellcastingSpent
      };
      next.diagnostics = [...(result.diagnostics ?? []), ...validateBlueprint(next).warnings];
      return next;
    }

    if (scope === "spellcasting" || scope === "combat.spellcasting") {
      if (next.locks?.spellcasting) return next;
      const result = rerollSpellcasting({
        request: next.metadata.requestSnapshot, registry: this.registry, spellSources: this.spellSources, blueprint: next, random: random.fork("spellcasting")
      });
      next.combat.spellcasting = result.spellcasting;
      const totalBudget = Number(next.metadata?.specialFeatureBudget?.limit ?? resolveAbilityPowerBudget(next.metadata.requestSnapshot, next.identity.role));
      const abilitySpent = Number(next.metadata?.abilityBudget?.spent ?? 0);
      const auraSpent = Number(next.resources?.auras?.[0]?.powerCost ?? 0);
      const afflictionSpent = Number(next.resources?.afflictions?.[0]?.powerCost ?? 0);
      const spellcastingSpent = Number(result.spent ?? 0);
      next.metadata.specialFeatureBudget = { limit: totalBudget, spent: abilitySpent + auraSpent + afflictionSpent + spellcastingSpent, remaining: Math.max(0, totalBudget - abilitySpent - auraSpent - afflictionSpent - spellcastingSpent), abilitySpent, auraSpent, afflictionSpent, spellcastingSpent };
      next.diagnostics = [...(result.diagnostics ?? []), ...validateBlueprint(next).warnings];
      return next;
    }

    if (scope.startsWith("spell:")) {
      const targetId = scope.slice("spell:".length);
      const result = rerollSpellSlot({ request: next.metadata.requestSnapshot, registry: this.registry, spellSources: this.spellSources, blueprint: next, targetId, random: random.fork(`spell-slot:${targetId}`) });
      next.combat.spellcasting = result.spellcasting;
      const spellcastingSpent = Number(result.spent ?? 0);
      next.metadata.specialFeatureBudget = { ...(next.metadata.specialFeatureBudget ?? {}), spellcastingSpent, spent: Number(next.metadata?.abilityBudget?.spent ?? 0) + Number(next.resources?.auras?.[0]?.powerCost ?? 0) + Number(next.resources?.afflictions?.[0]?.powerCost ?? 0) + spellcastingSpent };
      next.metadata.specialFeatureBudget.remaining = Math.max(0, Number(next.metadata.specialFeatureBudget.limit ?? 0) - Number(next.metadata.specialFeatureBudget.spent ?? 0));
      next.diagnostics = [...(result.diagnostics ?? []), ...validateBlueprint(next).warnings];
      return next;
    }

    if (scope === "defenses.affinities" || scope === "affinities") {
      if (next.locks?.["defenses.affinities"]) return next;
      const generated = regenerated();
      const merged = {};
      for (const kind of ["immunities", "resistances", "weaknesses"]) {
        const generatedEntries = deepClone(generated.defenses?.[kind] ?? []);
        const lockedEntries = (next.defenses?.[kind] ?? []).filter((entry) => entry?.locked);
        const keyOf = (entry) => `${entry.type}|${JSON.stringify(entry.exceptions ?? [])}`;
        const lockedKeys = new Set(lockedEntries.map(keyOf));
        merged[kind] = [...generatedEntries.filter((entry) => !lockedKeys.has(keyOf(entry))), ...deepClone(lockedEntries)];
      }
      const hpAdjustment = next.metadata?.requestSnapshot?.defensiveAffinities?.hpCompensation === "off"
        ? { value: 0, reasons: [] }
        : calculateAffinityHpAdjustment({ affinities: merged, hpRank: next.statistics.hp.rank });
      next.defenses = { ...merged, hpAdjustment };
      const baseValue = Number(next.statistics.hp.baseValue ?? next.statistics.hp.value - Number(next.statistics.hp.adjustment ?? blueprint.defenses?.hpAdjustment?.value ?? 0));
      next.statistics.hp.baseValue = baseValue;
      next.statistics.hp.adjustment = Number(hpAdjustment.value ?? 0);
      next.statistics.hp.value = Math.max(1, baseValue + Number(hpAdjustment.value ?? 0));
      next.identity.resolvedSubtypes = generated.identity.resolvedSubtypes;
      next.identity.traits = generated.identity.traits;
      next.diagnostics = validateBlueprint(next).warnings;
      return next;
    }

    if (scope === "defenses") {
      if (next.locks?.defenses) return next;
      const generated = regenerated();
      next.statistics.ac = generated.statistics.ac;
      next.statistics.hp = generated.statistics.hp;
      next.statistics.perception = generated.statistics.perception;
      next.statistics.saves = generated.statistics.saves;
      next.defenses = generated.defenses;
      next.identity.resolvedSubtypes = generated.identity.resolvedSubtypes;
      next.identity.traits = generated.identity.traits;
      next.diagnostics = validateBlueprint(next).warnings;
      return next;
    }

    throw new Error(`Unsupported reroll scope '${scope}' in the current Creature Forge engine.`);
  }
}
