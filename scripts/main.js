import { MODULE_ID, MODULE_VERSION } from "./constants.js";
import { getPublicApi, initializePublicApi } from "./api/public-api.js";
import { registerSettings } from "./settings.js";
import { initializeCreatureForgeUi, openCreatureForge } from "./ui/creature-forge.js";
import { initializeEffectRuntimeUi } from "./runtime/effect-runtime.js";
import { initializeSpecialFeatureRuntimeUi } from "./runtime/special-feature-runtime.js";
import { initializeLootRuntimeUi } from "./runtime/loot-runtime-ui.js";

Hooks.once("init", () => {
  registerSettings();
  initializePublicApi({ openCreatureForge });
  Hooks.on("pf2eAfflictionForgeReady", async () => {
    try {
      const api = getPublicApi();
      await api?.sources?.refreshAfflictionLibraries?.({ force: true });
      Hooks.callAll("pf2eCreatureForgeContentReady", api?.content?.getRegistrySnapshot?.());
    } catch (error) {
      console.warn(`${MODULE_ID} | Affliction Forge library bridge refresh failed.`, error);
    }
  });
});

Hooks.once("ready", () => {
  const manifestVersion = String(game.modules.get(MODULE_ID)?.version ?? "");
  if (manifestVersion && manifestVersion !== MODULE_VERSION) {
    const message = `${MODULE_ID} | Mixed installation detected: manifest ${manifestVersion}, scripts ${MODULE_VERSION}. Reinstall the module cleanly and restart Foundry.`;
    console.error(message);
    ui.notifications.error(message, { permanent: true });
    return;
  }

  const api = getPublicApi();
  initializeCreatureForgeUi();
  api.sources.refreshAfflictionLibraries().then(() => {
    Hooks.callAll("pf2eCreatureForgeContentReady", api.content.getRegistrySnapshot());
  }).catch((error) => {
    console.warn(`${MODULE_ID} | Could not discover Affliction Forge libraries during ready.`, error);
  });
  initializeEffectRuntimeUi({
    apply: (options) => api.runtime.applyEffect(options),
    cleanupActorResources: (actor) => api.runtime.cleanupActorEffects(actor)
  });
  initializeSpecialFeatureRuntimeUi({
    applyAffliction: (options) => api.runtime.applyAffliction(options)
  });
  initializeLootRuntimeUi({
    createDeferredLootActor: (actorOrBlueprint, options) => api.runtime.createDeferredLootActor(actorOrBlueprint, options)
  });
  Hooks.callAll("pf2eCreatureForgeReady", api);
  Hooks.callAll("pf2eCreatureForgeContentReady", api.content.getRegistrySnapshot());
  console.info(`${MODULE_ID} | Ready`, {
    moduleVersion: api.moduleVersion,
    apiVersion: api.version,
    schemaVersion: api.schemaVersion,
    integrations: api.integrations.getStatus()
  });
});
