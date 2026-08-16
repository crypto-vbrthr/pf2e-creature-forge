import { MODULE_VERSION } from "../constants.js";
import { createRandomSeed, SeededRandom } from "./rng.js";
import { createEmptyBlueprint, createGenerationRequest } from "./schemas.js";
import { resolveRolePreset } from "./role-presets.js";
import { AC_TABLE, HP_TABLE, PERCEPTION_TABLE, SAVE_TABLE, assertCreatureLevel, resolveHpRange, resolveRankValue } from "./tables.js";
import { validateBlueprint, validateGenerationRequest } from "./validator.js";
import { deepClone } from "./clone.js";

const SAVE_NAMES = ["fortitude", "reflex", "will"];

function resolveRequestedRank(requested, fallback) {
  return requested && requested !== "role" ? requested : fallback;
}

function resolveTrait(registry, type, value) {
  const entry = registry?.list(type).find((candidate) => candidate.slug === value || candidate.id === value);
  return entry?.trait ?? entry?.slug ?? value;
}

export class CreatureGenerator {
  constructor({ registry }) {
    this.registry = registry;
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
    const hpValue = random.fork("statistics.hp").int(hpRange.min, hpRange.max);
    const primaryTrait = resolveTrait(this.registry, "category", request.identity.category);
    const subtypeTraits = request.identity.subtypes.map((subtype) => resolveTrait(this.registry, "subtype", subtype));
    const traits = [...new Set([primaryTrait, ...subtypeTraits].filter(Boolean))];

    const blueprint = createEmptyBlueprint();
    blueprint.metadata = {
      ...blueprint.metadata,
      generatorVersion: MODULE_VERSION,
      seed,
      variation: request.generation.variation,
      requestSnapshot: deepClone({ ...request, generation: { ...request.generation, seed } })
    };
    blueprint.identity = {
      name: request.identity.name || "Creature",
      level,
      role: request.identity.role,
      category: request.identity.category,
      subtypes: [...request.identity.subtypes],
      traits,
      size: request.identity.size
    };
    blueprint.statistics = {
      ac: { rank: acRank, value: resolveRankValue(AC_TABLE, level, acRank) },
      hp: { rank: hpRank, value: hpValue, range: hpRange },
      perception: { rank: perceptionRank, value: resolveRankValue(PERCEPTION_TABLE, level, perceptionRank) },
      saves: Object.fromEntries(SAVE_NAMES.map((save) => [save, {
        rank: saveRanks[save],
        value: resolveRankValue(SAVE_TABLE, level, saveRanks[save])
      }])),
      speed: { land: 25, other: [] }
    };
    blueprint.combat = {
      attacks: Array.from({ length: Math.max(0, Math.min(2, Number(request.options.attackCount ?? 1))) }, (_, index) => ({
        id: `attack-${index + 1}`,
        state: "planned",
        profile: index === 0 ? "primary" : "secondary",
        locked: false
      })),
      spellcasting: []
    };
    blueprint.loot.policy = request.options.loot ?? "auto";
    blueprint.diagnostics = [
      ...requestValidation.warnings,
      ...validateBlueprint(blueprint).warnings
    ];
    blueprint.provenance = [{
      kind: "rules",
      source: "Pathfinder GM Core",
      section: "Building Creatures",
      note: "Core defensive statistics use the level/rank tables from the creature-building rules."
    }];
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
      next.statistics.hp.value = random.fork("statistics.hp").int(range.min, range.max);
      return next;
    }

    if (scope === "defenses") {
      if (next.locks?.defenses) return next;
      return this.generate({ ...deepClone(snapshot), generation: { ...snapshot.generation, seed: newSeed } });
    }

    throw new Error(`Unsupported reroll scope '${scope}' in Creature Forge 0.1.0.`);
  }
}
