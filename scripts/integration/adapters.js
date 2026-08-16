import { getModuleApi, integrationStatus } from "./module-bridge.js";

const IDS = Object.freeze({
  effect: "pf2e-critical-forge",
  aura: "pf2e-aura-forge",
  affliction: "pf2e-affliction-forge",
  item: "pf2e-item-forge",
  loot: "pf2e-loot-forge"
});

export class ForgeIntegrationHub {
  get effectApi() { return getModuleApi(IDS.effect); }
  get auraApi() { return getModuleApi(IDS.aura); }
  get afflictionApi() { return getModuleApi(IDS.affliction); }
  get itemApi() { return getModuleApi(IDS.item); }
  get lootApi() { return getModuleApi(IDS.loot); }

  status() {
    return {
      effect: integrationStatus(IDS.effect, {
        validate: (api) => typeof api.effects?.validate === "function",
        analyze: (api) => typeof api.effects?.analyze === "function",
        compile: (api) => typeof api.effects?.compile === "function",
        toItemSource: (api) => typeof api.effects?.toItemSource === "function",
        toItemSources: (api) => typeof api.effects?.toItemSources === "function",
        createItem: (api) => typeof api.effects?.createItem === "function",
        createItems: (api) => typeof api.effects?.createItems === "function",
        apply: (api) => typeof api.effects?.apply === "function",
        execute: (api) => typeof api.effects?.execute === "function",
        checkCompatibility: (api) => typeof api.effects?.checkCompatibility === "function",
        editor: (api) => typeof api.ui?.effectEditor?.create === "function"
      }),
      aura: integrationStatus(IDS.aura, {
        assignDefinition: (api) => typeof api.instances?.assignDefinition === "function",
        editor: (api) => typeof api.ui?.auraEditor?.create === "function"
      }),
      affliction: integrationStatus(IDS.affliction, {
        editor: (api) => typeof api.ui?.afflictionEditor?.create === "function"
      }),
      item: integrationStatus(IDS.item, {
        api: (api) => Boolean(api)
      }),
      loot: integrationStatus(IDS.loot, {
        embeddedEditor: (api) => typeof api.createEmbeddedEditor === "function",
        generateCreatureLoot: (api) => typeof api.generateLootForCreature === "function",
        generateCreatureInventory: (api) => typeof api.generateInventoryForCreature === "function"
      })
    };
  }
}
