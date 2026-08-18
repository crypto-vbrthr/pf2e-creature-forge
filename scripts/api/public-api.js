import {
  API_VERSION, BLUEPRINT_SCHEMA_VERSION, CONTENT_SCHEMA_VERSION, CONTENT_TYPES, MODULE_ID,
  MODULE_VERSION, REQUEST_SCHEMA_VERSION, SETTINGS
} from "../constants.js";
import { compileActorSource, createActorFromBlueprint } from "../core/compiler.js";
import { CompendiumDiscoveryManager } from "../core/compendium-discovery.js";
import { registerCoreContent } from "../core/core-content.js";
import { CreatureGenerator } from "../core/generator.js";
import { ContentRegistry } from "../core/registry.js";
import { createRandom, createRandomSeed, SeededRandom } from "../core/rng.js";
import { createGenerationRequest } from "../core/schemas.js";
import { listCompendiumSources } from "../core/sources.js";
import { validateBlueprint, validateGenerationRequest } from "../core/validator.js";
import { ForgeIntegrationHub } from "../integration/adapters.js";
import { AfflictionForgeLibraryBridge } from "../integration/affliction-library-bridge.js";
import { createCreatureEditorUiApi } from "../ui/creature-editor.js";
import { estimateAbilityPower, listAbilityCandidates, resolveAbilityPowerBudget } from "../core/ability-engine.js";
import { CreatureEffectRuntime } from "../runtime/effect-runtime.js";
import { CreatureSpecialFeatureRuntime } from "../runtime/special-feature-runtime.js";
import { estimateSpecialPower, specialFeatureChance } from "../core/special-features.js";
import { resolveAfflictionDelivery, assignAfflictionDeliveries } from "../core/affliction-delivery.js";
import { SpellSourceManager } from "../core/spell-source-manager.js";
import { estimateSpellcastingPower, highestSpellRankForLevel, spellcastingChance } from "../core/spellcasting.js";
import { CreatureSpellRuntime } from "../runtime/spell-runtime.js";
import { CreatureLootIntegration } from "../integration/loot-integration.js";
import { CreatureLootRuntime } from "../runtime/loot-runtime.js";
import { createLootPlan, lootChannelChance } from "../core/loot.js";
import { limitedAreaDamageFormula, resolveDragonBreathProfile, resolveElementalSignatureProfile, resolveSignaturePlan } from "../core/signature-powers.js";

let apiInstance = null;

function serializeRuntimeError(error) {
  return {
    name: error?.name ?? "Error",
    message: error?.message ?? String(error),
    stack: error?.stack ?? null
  };
}

async function runRuntimeStep(name, enabled, task, diagnostics) {
  if (!enabled) return null;
  try {
    return await task();
  } catch (error) {
    const serialized = serializeRuntimeError(error);
    diagnostics.push({ level: "error", code: `RUNTIME_${name.toUpperCase()}_FAILED`, subsystem: name, ...serialized });
    console.error(`${MODULE_ID} | ${name} runtime initialization failed.`, error);
    return null;
  }
}

export function initializePublicApi({ openCreatureForge } = {}) {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  const spellSources = new SpellSourceManager();
  const generator = new CreatureGenerator({ registry, spellSources });
  const discovery = new CompendiumDiscoveryManager({ registry });
  const integrations = new ForgeIntegrationHub();
  const afflictionLibraryBridge = new AfflictionForgeLibraryBridge({ registry, integrations });
  const runtime = new CreatureEffectRuntime({ integrations });
  const specialRuntime = new CreatureSpecialFeatureRuntime({ integrations });
  const spellRuntime = new CreatureSpellRuntime();
  const lootIntegration = new CreatureLootIntegration({ integrations });
  const lootRuntime = new CreatureLootRuntime({ integrations });

  const registerByType = (type) => (definition, options = {}) => registry.register(type, definition, options);

  const api = {
    version: API_VERSION,
    moduleVersion: MODULE_VERSION,
    schemaVersion: {
      request: REQUEST_SCHEMA_VERSION,
      blueprint: BLUEPRINT_SCHEMA_VERSION,
      content: CONTENT_SCHEMA_VERSION
    },
    contentTypes: [...CONTENT_TYPES],

    createRequest: (input = {}) => createGenerationRequest(input),
    generate: (request = {}) => {
      const normalized = createGenerationRequest(request);
      if (!discovery.isPrepared(normalized.sources) || !afflictionLibraryBridge.isPrepared(normalized.sources) || !spellSources.isPrepared(normalized.sources)) {
        throw new Error("Creature Forge sources are not prepared. Call api.generateAsync(request) or await api.sources.ensure(request.sources) before synchronous generation.");
      }
      return generator.generate(normalized);
    },
    generateAsync: async (request = {}) => {
      const normalized = createGenerationRequest(request);
      await discovery.ensure(normalized.sources);
      await afflictionLibraryBridge.ensure(normalized.sources);
      await spellSources.ensure(normalized.sources);
      const blueprint = generator.generate(normalized);
      return lootIntegration.generateForBlueprint(blueprint, normalized);
    },
    reroll: (blueprint, options = {}) => generator.reroll(blueprint, options),
    rerollAsync: async (blueprint, options = {}) => {
      const rerolled = generator.reroll(blueprint, options);
      const scope = String(options.scope ?? "all");
      if (scope === "all" || scope === "loot" || scope.startsWith("loot:")) {
        return lootIntegration.generateForBlueprint(rerolled, rerolled?.metadata?.requestSnapshot ?? {});
      }
      return rerolled;
    },
    validateRequest: (request) => validateGenerationRequest(createGenerationRequest(request), { registry }),
    validate: (blueprint) => validateBlueprint(blueprint),
    compile: (blueprint, options = {}) => compileActorSource(blueprint, options),
    createActor: async (blueprint, options = {}) => {
      let sourceBlueprint = blueprint;
      if (sourceBlueprint?.loot && sourceBlueprint.loot.generated !== true) {
        sourceBlueprint = await lootIntegration.generateForBlueprint(
          sourceBlueprint,
          sourceBlueprint?.metadata?.requestSnapshot ?? {}
        );
      }
      return createActorFromBlueprint(sourceBlueprint, {
        ...options,
        postCreate: async (actor, sourceBlueprint, compiled) => {
        const diagnostics = [];
        const effectResult = await runRuntimeStep(
          "effects",
          options.materializeEffects !== false,
          () => runtime.initializeActor(actor, sourceBlueprint),
          diagnostics
        );
        const specialResult = await runRuntimeStep(
          "specialFeatures",
          options.materializeSpecialFeatures !== false,
          () => specialRuntime.initializeActor(actor, sourceBlueprint),
          diagnostics
        );
        const spellResult = await runRuntimeStep(
          "spellcasting",
          options.materializeSpellcasting !== false,
          () => spellRuntime.materialize(actor, sourceBlueprint),
          diagnostics
        );
        const lootResult = await runRuntimeStep(
          "loot",
          options.materializeLoot !== false,
          () => lootRuntime.materialize(actor, sourceBlueprint),
          diagnostics
        );
        const runtimeStatus = {
          schemaVersion: 1,
          effects: options.materializeEffects === false ? "skipped" : effectResult ? "ready" : "failed",
          specialFeatures: options.materializeSpecialFeatures === false ? "skipped" : specialResult ? "ready" : "failed",
          spellcasting: options.materializeSpellcasting === false ? "skipped" : spellResult ? "ready" : "failed",
          loot: options.materializeLoot === false ? "skipped" : lootResult ? "ready" : "failed",
          diagnostics
        };
        if (typeof actor?.update === "function") {
          try {
            await actor.update({ [`flags.${MODULE_ID}.runtimeStatus`]: runtimeStatus }, { render: false });
          } catch (error) {
            const serialized = serializeRuntimeError(error);
            diagnostics.push({ level: "warning", code: "RUNTIME_STATUS_PERSIST_FAILED", subsystem: "runtimeStatus", ...serialized });
            console.warn(`${MODULE_ID} | Could not persist consolidated runtime status.`, error);
          }
        }
        if (options.strictRuntime === true && diagnostics.length) {
          const error = new Error(`Creature Forge runtime initialization failed in ${[...new Set(diagnostics.map((entry) => entry.subsystem))].join(", ")}.`);
          error.diagnostics = diagnostics;
          throw error;
        }
        // External host callbacks still keep normal exception semantics. Internal
        // optional integrations are isolated above so one Forge cannot prevent the
        // remaining materializers from finishing or hide an already-created Actor.
        const external = typeof options.postCreate === "function"
          ? await options.postCreate(actor, sourceBlueprint, compiled)
          : null;
          return { creatureForge: { effects: effectResult, specialFeatures: specialResult, spellcasting: spellResult, loot: lootResult, diagnostics, runtimeStatus }, external };
        }
      });
    },

    random: {
      createSeed: createRandomSeed,
      create: createRandom,
      SeededRandom
    },

    abilities: {
      listCandidates: (request = {}, options = {}) => {
        const normalized = createGenerationRequest(request);
        return listAbilityCandidates({
          request: normalized,
          registry,
          level: normalized.identity.level,
          roleId: normalized.identity.role,
          category: normalized.identity.category,
          subtypes: normalized.identity.subtypes,
          includeInvalid: Boolean(options.includeInvalid)
        });
      },
      estimatePower: (definition) => estimateAbilityPower(definition),
      resolvePowerBudget: (request = {}) => {
        const normalized = createGenerationRequest(request);
        return resolveAbilityPowerBudget(normalized, normalized.identity.role);
      },
      listLibraries: (filters = {}) => registry.listAbilityLibraries(filters),
      validateDependencies: (definitionOrId) => registry.validateAbilityDependencies(definitionOrId),
      signature: {
        limitedAreaDamageFormula,
        resolveDragonBreathProfile,
        resolveElementalSignatureProfile,
        plan: (request = {}, options = {}) => {
          const normalized = createGenerationRequest(request);
          const random = new SeededRandom(options.seed ?? `${normalized.generation.seed || createRandomSeed()}:signature-api`);
          return resolveSignaturePlan({
            request: normalized, registry, level: normalized.identity.level, roleId: normalized.identity.role,
            category: normalized.identity.category, subtypes: normalized.identity.subtypes, random, force: Boolean(options.force)
          });
        }
      }
    },

    spells: {
      listCompendiums: () => spellSources.listCompendiums(),
      getDefaultSourceIds: () => spellSources.getDefaultSourceIds(),
      ensure: (sources = {}, options = {}) => spellSources.ensure(sources, options),
      list: (selectedSources = []) => spellSources.listSpells(selectedSources),
      getStatus: () => spellSources.status(),
      chance: (request = {}) => { const normalized = createGenerationRequest(request); return spellcastingChance({ request: normalized, category: normalized.identity.category, subtypes: normalized.identity.subtypes, roleId: normalized.identity.role }); },
      highestRankForLevel: highestSpellRankForLevel,
      estimatePower: estimateSpellcastingPower
    },

    loot: {
      plan: (request = {}, blueprint = null) => {
        const normalized = createGenerationRequest(request);
        const base = blueprint ?? generator.generate(normalized);
        const random = new SeededRandom(`${base?.metadata?.seed ?? normalized.generation.seed ?? "loot"}:loot-plan`);
        return createLootPlan({ request: normalized, blueprint: base, random });
      },
      chance: (channel, request = {}) => {
        const normalized = createGenerationRequest(request);
        return lootChannelChance({ channel, category: normalized.identity.category, roleId: normalized.identity.role, variation: normalized.generation.variation, level: normalized.identity.level, hasSpellcasting: normalized.spellcasting.mode !== "none" });
      },
      generate: (blueprint, request = null) => lootIntegration.generateForBlueprint(blueprint, request ?? blueprint?.metadata?.requestSnapshot ?? {}),
      refresh: async (blueprint) => {
        const planned = generator.reroll(blueprint, { scope: "loot" });
        return lootIntegration.generateForBlueprint(planned, planned?.metadata?.requestSnapshot ?? {});
      },
      refreshChannel: async (blueprint, channel) => {
        const planned = generator.reroll(blueprint, { scope: `loot:${channel}` });
        return lootIntegration.generateForBlueprint(planned, planned?.metadata?.requestSnapshot ?? {});
      },
      listCompendiums: () => listCompendiumSources({ documentName: "Item" }),
      getStatus: () => ({ lootForgeAvailable: lootIntegration.available, itemForgeAvailable: lootIntegration.itemForgeAvailable }),
      createLootActor: (actorOrBlueprint, options = {}) => lootRuntime.createDeferredLootActor(actorOrBlueprint, options)
    },

    specialFeatures: {
      chance: (kind, request = {}) => {
        const normalized = createGenerationRequest(request);
        return specialFeatureChance({
          request: normalized,
          kind,
          category: normalized.identity.category,
          subtypes: normalized.identity.subtypes
        });
      },
      estimatePower: (definition, kind = null) => estimateSpecialPower(definition, kind),
      listAuras: (filters = {}) => registry.list("aura", filters),
      listAfflictions: (filters = {}) => registry.list("affliction", filters),
      listAuraLibraries: (filters = {}) => registry.listAuraLibraries(filters),
      listAfflictionLibraries: (filters = {}) => registry.listAfflictionLibraries(filters),
      resolveAfflictionDelivery: (resource, blueprint) => resolveAfflictionDelivery(resource, blueprint),
      assignAfflictionDeliveries: (blueprint) => assignAfflictionDeliveries(blueprint)
    },

    auras: {
      get available() { return Boolean(integrations.auraApi?.instances?.assignDefinition); },
      validate: (definition) => integrations.auraApi?.definitions?.validate?.(definition) ?? { valid: true, errors: [], warnings: [], unavailable: true },
      assignDefinition: async (actor, definition, options = {}) => {
        const auraApi = integrations.auraApi;
        if (!auraApi?.instances?.assignDefinition) throw new Error("Aura Forge integration is unavailable.");
        return auraApi.instances.assignDefinition(actor, definition, options);
      }
    },

    afflictions: {
      get available() { return Boolean(integrations.afflictionApi?.engine?.applyDefinition); },
      validate: (definition) => integrations.afflictionApi?.definitions?.validate?.(definition) ?? { valid: true, errors: [], warnings: [], unavailable: true },
      applyDefinition: async (definition, targets, options = {}) => {
        const afflictionApi = integrations.afflictionApi;
        if (!afflictionApi?.engine?.applyDefinition) throw new Error("Affliction Forge integration is unavailable.");
        return afflictionApi.engine.applyDefinition(definition, targets, options);
      },
      libraries: {
        get available() { return afflictionLibraryBridge.available; },
        refresh: (options = {}) => afflictionLibraryBridge.refreshLibraries(options),
        ensure: (sources = {}, options = {}) => afflictionLibraryBridge.ensure(sources, options),
        list: () => afflictionLibraryBridge.listLibraries(),
        status: () => afflictionLibraryBridge.status()
      }
    },

    effects: {
      get available() { return Boolean(integrations.effectApi?.effects); },
      validate: (definition) => integrations.effectApi?.effects?.validate?.(definition) ?? { valid: true, errors: [], warnings: [], unavailable: true },
      analyze: (definition, context = {}) => integrations.effectApi?.effects?.analyze?.(definition, context) ?? { valid: true, errors: [], warnings: [], unavailable: true },
      compile: async (definition, context = {}) => {
        const effectApi = integrations.effectApi?.effects;
        if (!effectApi?.compile) throw new Error("Effect Forge integration is unavailable.");
        return effectApi.compile(definition, context);
      },
      toItemSource: async (definition, context = {}) => {
        const effectApi = integrations.effectApi?.effects;
        if (!effectApi?.toItemSource) throw new Error("Effect Forge integration is unavailable.");
        return effectApi.toItemSource(definition, context);
      },
      toItemSources: async (definition, context = {}) => {
        const effectApi = integrations.effectApi?.effects;
        if (!effectApi?.toItemSources) throw new Error("Effect Forge integration is unavailable.");
        return effectApi.toItemSources(definition, context);
      },
      createItem: async (definition, options = {}) => {
        const effectApi = integrations.effectApi?.effects;
        if (!effectApi?.createItem) throw new Error("Effect Forge integration is unavailable.");
        return effectApi.createItem(definition, options);
      },
      createItems: async (definition, options = {}) => {
        const effectApi = integrations.effectApi?.effects;
        if (!effectApi?.createItems) throw new Error("Effect Forge integration is unavailable.");
        return effectApi.createItems(definition, options);
      },
      apply: async (definition, targets, options = {}) => {
        const effectApi = integrations.effectApi?.effects;
        if (!effectApi?.apply) throw new Error("Effect Forge integration is unavailable.");
        return effectApi.apply(definition, targets, options);
      },
      execute: async (definition, targets, options = {}) => {
        const effectApi = integrations.effectApi?.effects;
        if (!effectApi?.execute) throw new Error("Effect Forge integration is unavailable.");
        return effectApi.execute(definition, targets, options);
      },
      checkCompatibility: async (definition, target, options = {}) => {
        const effectApi = integrations.effectApi?.effects;
        if (!effectApi?.checkCompatibility) throw new Error("Effect Forge integration is unavailable.");
        return effectApi.checkCompatibility(definition, target, options);
      }
    },

    runtime: {
      get available() { return runtime.available; },
      get materializationAvailable() { return runtime.materializationAvailable; },
      resolve: (actor, options = {}) => runtime.resolve(actor, options),
      resolveTargets: (actor, targetMode = "target", explicitTargets = null) => runtime.resolveTargets(actor, targetMode, explicitTargets),
      applyEffect: (options = {}) => runtime.apply(options),
      materializeEffects: (actor, blueprint = null) => runtime.materialize(actor, blueprint ?? undefined),
      refreshActorEffects: (actor, blueprint = null) => runtime.initializeActor(actor, blueprint ?? undefined),
      cleanupActorEffects: (actor) => runtime.cleanupActorResources(actor),
      applyAffliction: (options = {}) => specialRuntime.applyAffliction(options),
      materializeAuras: (actor, blueprint = null) => specialRuntime.materializeAuras(actor, blueprint ?? undefined),
      materializeAfflictions: (actor, blueprint = null) => specialRuntime.materializeAfflictions(actor, blueprint ?? undefined),
      cleanupActorSpecialFeatures: async (actor) => ({ auras: await specialRuntime.cleanupAuras(actor), afflictions: await specialRuntime.cleanupAfflictions(actor) }),
      refreshSpecialFeatures: (actor, blueprint = null) => specialRuntime.initializeActor(actor, blueprint ?? undefined),
      materializeSpellcasting: (actor, blueprint = null) => spellRuntime.materialize(actor, blueprint ?? undefined),
      refreshSpellcasting: (actor, blueprint = null) => spellRuntime.materialize(actor, blueprint ?? undefined),
      cleanupSpellcasting: (actor) => spellRuntime.cleanup(actor),
      materializeLoot: (actor, blueprint = null) => lootRuntime.materialize(actor, blueprint ?? undefined),
      refreshLoot: (actor, blueprint = null) => lootRuntime.materialize(actor, blueprint ?? undefined),
      cleanupCarriedLoot: (actor) => lootRuntime.cleanupCarried(actor),
      createDeferredLootActor: (actorOrBlueprint, options = {}) => lootRuntime.createDeferredLootActor(actorOrBlueprint, options)
    },

    content: {
      registerBundle: (bundle, options = {}) => registry.registerBundle(bundle, options),
      unregisterBundle: (bundleId) => registry.unregisterBundle(bundleId),
      registerCategory: registerByType("category"),
      registerSubtype: registerByType("subtype"),
      registerNameTemplate: registerByType("nameTemplate"),
      registerAbility: registerByType("ability"),
      registerAbilityLibrary: (library, options = {}) => registry.registerAbilityLibrary(library, options),
      unregisterAbilityLibrary: (libraryId) => registry.unregisterAbilityLibrary(libraryId),
      getAbilityLibrary: (libraryId) => registry.getAbilityLibrary(libraryId),
      listAbilityLibraries: (filters = {}) => registry.listAbilityLibraries(filters),
      getDefaultAbilityLibraryIds: () => registry.getDefaultAbilityLibraryIds(),
      validateAbilityDependencies: (definitionOrId) => registry.validateAbilityDependencies(definitionOrId),
      validateAbilityLibrary: (libraryId) => registry.validateAbilityLibrary(libraryId),
      registerAura: registerByType("aura"),
      registerAuraLibrary: (library, options = {}) => registry.registerAuraLibrary(library, options),
      unregisterAuraLibrary: (libraryId) => registry.unregisterAuraLibrary(libraryId),
      getAuraLibrary: (libraryId) => registry.getAuraLibrary(libraryId),
      listAuraLibraries: (filters = {}) => registry.listAuraLibraries(filters),
      getDefaultAuraLibraryIds: () => registry.getDefaultAuraLibraryIds(),
      registerAffliction: registerByType("affliction"),
      registerAfflictionLibrary: (library, options = {}) => registry.registerAfflictionLibrary(library, options),
      unregisterAfflictionLibrary: (libraryId) => registry.unregisterAfflictionLibrary(libraryId),
      getAfflictionLibrary: (libraryId) => registry.getAfflictionLibrary(libraryId),
      listAfflictionLibraries: (filters = {}) => registry.listAfflictionLibraries(filters),
      getDefaultAfflictionLibraryIds: () => registry.getDefaultAfflictionLibraryIds(),
      registerEffect: registerByType("effect"),
      registerPoison: registerByType("poison"),
      registerSpellProfile: registerByType("spellProfile"),
      registerSpellPackage: registerByType("spellPackage"),
      registerLootProfile: registerByType("lootProfile"),
      get: (type, id) => registry.get(type, id),
      list: (type, filters = {}) => registry.list(type, filters),
      query: (type, context = {}) => registry.query(type, context),
      unregister: (type, id) => registry.unregister(type, id),
      getDiagnostics: () => registry.getDiagnostics(),
      getRegistrySnapshot: () => registry.snapshot()
    },

    sources: {
      listCompendiums: (options = {}) => listCompendiumSources(options),
      listCreatureCompendiums: () => discovery.listCompendiums(),
      discover: (compendiumId, options = {}) => discovery.discover(compendiumId, options),
      ensure: async (sources = {}, options = {}) => {
        const [compendiums, afflictions, spells] = await Promise.all([
          discovery.ensure(sources, options),
          afflictionLibraryBridge.ensure(sources, options),
          spellSources.ensure(sources, options)
        ]);
        return { compendiums, afflictions, spells };
      },
      listContent: (type, options = {}) => discovery.listContent(type, options),
      getStatus: () => ({ compendiums: discovery.getStatus(), afflictions: afflictionLibraryBridge.status(), spells: spellSources.status(), loot: { integration: lootIntegration.available, itemForge: lootIntegration.itemForgeAvailable } }),
      isPrepared: (sources = {}) => discovery.isPrepared(sources) && afflictionLibraryBridge.isPrepared(sources) && spellSources.isPrepared(sources),
      refreshAfflictionLibraries: (options = {}) => afflictionLibraryBridge.refreshLibraries(options),
      clearCache: () => { discovery.clearCache(); afflictionLibraryBridge.clearCache(); spellSources.clearCache(); return true; },
      getDefaults: () => {
        try {
          const stored = globalThis.game?.settings?.get?.(MODULE_ID, SETTINGS.SOURCE_DEFAULTS) ?? {};
          const abilities = [...new Set((stored.abilities ?? []).map(String).filter(Boolean))];
          const auras = [...new Set((stored.auras ?? []).map(String).filter(Boolean))];
          const afflictions = [...new Set((stored.afflictions ?? []).map(String).filter(Boolean))];
          return {
            categories: [...new Set((stored.categories ?? []).map(String).filter(Boolean))],
            subtypes: [...new Set((stored.subtypes ?? []).map(String).filter(Boolean))],
            abilities: abilities.length ? abilities : registry.getDefaultAbilityLibraryIds(),
            auras: auras.length ? auras : registry.getDefaultAuraLibraryIds(),
            // Empty means "use the current default Affliction libraries". This lets
            // Affliction Forge provider libraries discovered after ready participate
            // without baking a stale library list into the request.
            afflictions,
            spells: [...new Set((stored.spells ?? []).map(String).filter(Boolean))],
            loot: [...new Set((stored.loot ?? []).map(String).filter(Boolean))]
          };
        } catch {
          return { categories: [], subtypes: [], abilities: registry.getDefaultAbilityLibraryIds(), auras: registry.getDefaultAuraLibraryIds(), afflictions: [], spells: [], loot: [] };
        }
      },
      setDefaults: async (sources = {}) => {
        const value = {
          categories: [...new Set((sources.categories ?? []).map(String).filter(Boolean))],
          subtypes: [...new Set((sources.subtypes ?? []).map(String).filter(Boolean))],
          abilities: [...new Set((sources.abilities ?? registry.getDefaultAbilityLibraryIds()).map(String).filter(Boolean))],
          auras: [...new Set((sources.auras ?? registry.getDefaultAuraLibraryIds()).map(String).filter(Boolean))],
          afflictions: [...new Set((sources.afflictions ?? registry.getDefaultAfflictionLibraryIds()).map(String).filter(Boolean))],
          spells: [...new Set((sources.spells ?? []).map(String).filter(Boolean))],
          loot: [...new Set((sources.loot ?? []).map(String).filter(Boolean))]
        };
        await globalThis.game?.settings?.set?.(MODULE_ID, SETTINGS.SOURCE_DEFAULTS, value);
        return value;
      }
    },

    integrations: {
      getStatus: () => integrations.status(),
      getEffectApi: () => integrations.effectApi,
      getAuraApi: () => integrations.auraApi,
      getAfflictionApi: () => integrations.afflictionApi,
      getItemApi: () => integrations.itemApi,
      getLootApi: () => integrations.lootApi
    },

    ui: {
      openCreatureForge: () => openCreatureForge?.(),
      creatureEditor: createCreatureEditorUiApi({ apiProvider: () => api })
    }
  };

  apiInstance = api;
  const module = globalThis.game?.modules?.get?.(MODULE_ID);
  if (module) module.api = api;
  return api;
}

export function getPublicApi() {
  return apiInstance;
}
