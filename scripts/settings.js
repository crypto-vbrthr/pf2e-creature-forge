import { MODULE_ID, SETTINGS } from "./constants.js";

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.WINDOW_STATE, {
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });
}
