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
import { listAbilityCandidates } from "../core/ability-engine.js";

let apiInstance = null;

export function initializePublicApi({ openCreatureForge } = {}) {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  const generator = new CreatureGenerator({ registry });
  const discovery = new CompendiumDiscoveryManager({ registry });
  const integrations = new ForgeIntegrationHub();

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
    createActor: (blueprint, options = {}) => createActorFromBlueprint(blueprint, options),

    random: {
      createSeed: createRandomSeed,
      create: createRandom,
      SeededRandom
    },

    abilities: {
      listCandidates: (request = {}) => {
        const normalized = createGenerationRequest(request);
        return listAbilityCandidates({
          request: normalized,
          registry,
          level: normalized.identity.level,
          roleId: normalized.identity.role,
          category: normalized.identity.category,
          subtypes: normalized.identity.subtypes
        });
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

    content: {
      registerBundle: (bundle, options = {}) => registry.registerBundle(bundle, options),
      unregisterBundle: (bundleId) => registry.unregisterBundle(bundleId),
      registerCategory: registerByType("category"),
      registerSubtype: registerByType("subtype"),
      registerNameTemplate: registerByType("nameTemplate"),
      registerAbility: registerByType("ability"),
      registerAura: registerByType("aura"),
      registerAffliction: registerByType("affliction"),
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
          return {
            categories: [...new Set((stored.categories ?? []).map(String).filter(Boolean))],
            subtypes: [...new Set((stored.subtypes ?? []).map(String).filter(Boolean))]
          };
        } catch {
          return { categories: [], subtypes: [] };
        }
      },
      setDefaults: async (sources = {}) => {
        const value = {
          categories: [...new Set((sources.categories ?? []).map(String).filter(Boolean))],
          subtypes: [...new Set((sources.subtypes ?? []).map(String).filter(Boolean))]
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
