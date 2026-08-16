import { MODULE_ID, SETTINGS } from "../constants.js";
import { getPublicApi } from "../api/public-api.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function normalizedPosition(value = {}) {
  const result = {};
  for (const key of ["width", "height", "left", "top"]) {
    if (Number.isFinite(Number(value?.[key]))) result[key] = Number(value[key]);
  }
  return result;
}

function upgradeLegacyWindowSize(value = {}) {
  const next = { ...value };
  const legacyWidth = Number(next.width);
  const legacyHeight = Number(next.height);
  if ((!Number.isFinite(legacyWidth) || legacyWidth <= 1060) && (!Number.isFinite(legacyHeight) || legacyHeight <= 780)) {
    next.width = 1280;
    next.height = 860;
  }
  return next;
}

export class CreatureForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "pf2e-creature-forge-app",
    classes: ["pf2e-creature-forge", "creature-forge-app"],
    window: {
      title: "PF2E_CREATURE_FORGE.WindowTitle",
      icon: "fa-solid fa-dragon",
      resizable: true
    },
    position: { width: 1280, height: 860 }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/creature-forge-app.hbs` }
  };

  constructor(options = {}) {
    let saved = {};
    try { saved = upgradeLegacyWindowSize(normalizedPosition(game.settings.get(MODULE_ID, SETTINGS.WINDOW_STATE))); } catch { saved = {}; }
    super(foundry.utils.mergeObject({ position: saved }, options, { inplace: false }));
    this.editor = null;
    this.persistTimer = null;
  }

  async _prepareContext() {
    const api = getPublicApi();
    return {
      moduleVersion: api?.moduleVersion ?? "",
      apiVersion: api?.version ?? ""
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const host = this.element?.querySelector?.("[data-creature-editor-host]");
    if (!(host instanceof HTMLElement)) return;
    const api = getPublicApi();
    if (!this.editor) {
      this.editor = api.ui.creatureEditor.create({
        mode: "create",
        layout: "full",
        capabilities: {
          generation: true,
          actorCreation: true,
          sourceSelection: false,
          advancedEditing: true
        }
      });
    }
    this.editor.mount(host).catch((error) => {
      console.error(`${MODULE_ID} | Embedded creature editor mount failed.`, error);
      ui.notifications.error(game.i18n.localize("PF2E_CREATURE_FORGE.Notifications.EditorFailed"));
    });
  }

  _onPosition(position) {
    super._onPosition(position);
    globalThis.clearTimeout(this.persistTimer);
    this.persistTimer = globalThis.setTimeout(() => this.#persistPosition(), 250);
  }

  async #persistPosition() {
    try {
      await game.settings.set(MODULE_ID, SETTINGS.WINDOW_STATE, normalizedPosition(this.position ?? {}));
    } catch (error) {
      console.debug(`${MODULE_ID} | Window state persistence failed.`, error);
    }
  }

  async close(options = {}) {
    this.editor?.unmount?.({ clearContainer: false });
    globalThis.clearTimeout(this.persistTimer);
    await this.#persistPosition();
    return super.close(options);
  }
}
