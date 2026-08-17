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
import { createCreatureEditorUiApi } from "../ui/creature-editor.js";
import { estimateAbilityPower, listAbilityCandidates, resolveAbilityPowerBudget } from "../core/ability-engine.js";
import { CreatureEffectRuntime } from "../runtime/effect-runtime.js";
import { CreatureSpecialFeatureRuntime } from "../runtime/special-feature-runtime.js";
import { estimateSpecialPower, specialFeatureChance } from "../core/special-features.js";
import { resolveAfflictionDelivery, assignAfflictionDeliveries } from "../core/affliction-delivery.js";

let apiInstance = null;

export function initializePublicApi({ openCreatureForge } = {}) {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  const generator = new CreatureGenerator({ registry });
  const discovery = new CompendiumDiscoveryManager({ registry });
  const integrations = new ForgeIntegrationHub();
  const runtime = new CreatureEffectRuntime({ integrations });
  const specialRuntime = new CreatureSpecialFeatureRuntime({ integrations });

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
      if (!discovery.isPrepared(normalized.sources)) {
        throw new Error("Creature Forge compendium sources are not prepared. Call api.generateAsync(request) or await api.sources.ensure(request.sources) before synchronous generation.");
      }
      return generator.generate(normalized);
    },
    generateAsync: async (request = {}) => {
      const normalized = createGenerationRequest(request);
      await discovery.ensure(normalized.sources);
      return generator.generate(normalized);
    },
    reroll: (blueprint, options = {}) => generator.reroll(blueprint, options),
    validateRequest: (request) => validateGenerationRequest(createGenerationRequest(request), { registry }),
    validate: (blueprint) => validateBlueprint(blueprint),
    compile: (blueprint, options = {}) => compileActorSource(blueprint, options),
    createActor: (blueprint, options = {}) => createActorFromBlueprint(blueprint, {
      ...options,
      postCreate: async (actor, sourceBlueprint, compiled) => {
        const effectResult = options.materializeEffects === false ? null : await runtime.initializeActor(actor, sourceBlueprint);
        const specialResult = options.materializeSpecialFeatures === false ? null : await specialRuntime.initializeActor(actor, sourceBlueprint);
        const external = typeof options.postCreate === "function"
          ? await options.postCreate(actor, sourceBlueprint, compiled)
          : null;
        return { creatureForge: { effects: effectResult, specialFeatures: specialResult }, external };
      }
    }),

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
      validateDependencies: (definitionOrId) => registry.validateAbilityDependencies(definitionOrId)
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
      refreshSpecialFeatures: (actor, blueprint = null) => specialRuntime.initializeActor(actor, blueprint ?? undefined)
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
      ensure: (sources = {}, options = {}) => discovery.ensure(sources, options),
      listContent: (type, options = {}) => discovery.listContent(type, options),
      getStatus: () => discovery.getStatus(),
      isPrepared: (sources = {}) => discovery.isPrepared(sources),
      clearCache: () => discovery.clearCache(),
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
            afflictions: afflictions.length ? afflictions : registry.getDefaultAfflictionLibraryIds()
          };
        } catch {
          return { categories: [], subtypes: [], abilities: registry.getDefaultAbilityLibraryIds(), auras: registry.getDefaultAuraLibraryIds(), afflictions: registry.getDefaultAfflictionLibraryIds() };
        }
      },
      setDefaults: async (sources = {}) => {
        const value = {
          categories: [...new Set((sources.categories ?? []).map(String).filter(Boolean))],
          subtypes: [...new Set((sources.subtypes ?? []).map(String).filter(Boolean))],
          abilities: [...new Set((sources.abilities ?? registry.getDefaultAbilityLibraryIds()).map(String).filter(Boolean))],
          auras: [...new Set((sources.auras ?? registry.getDefaultAuraLibraryIds()).map(String).filter(Boolean))],
          afflictions: [...new Set((sources.afflictions ?? registry.getDefaultAfflictionLibraryIds()).map(String).filter(Boolean))]
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
