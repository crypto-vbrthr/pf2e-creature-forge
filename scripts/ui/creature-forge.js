import { MODULE_ID } from "../constants.js";
import { CreatureForgeApp } from "./creature-forge-app.js";
import { localize } from "../i18n.js";

let app = null;

export async function openCreatureForge() {
  if (!game.user?.isGM) {
    ui.notifications.warn(localize("PF2E_CREATURE_FORGE.Notifications.GmOnly", "Only the GM can open Creature Forge."));
    return null;
  }
  app ??= new CreatureForgeApp();
  await app.render({ force: true });
  app.bringToFront?.();
  return app;
}

function getRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function isActorDirectory(appRef, root) {
  const tabName = appRef?.tabName ?? appRef?.options?.tabName ?? appRef?.id ?? "";
  if (String(tabName).toLowerCase().includes("actor")) return true;
  return Boolean(root?.matches?.("#actors, .actors-directory") || root?.querySelector?.("#actors, .actors-directory"));
}

function injectButton(appRef, html) {
  if (!game.user?.isGM) return;
  const root = getRoot(html);
  if (!root || !isActorDirectory(appRef, root)) return;
  if (root.querySelector(`[data-${MODULE_ID}-button]`)) return;
  const target = [
    ".directory-header .header-actions",
    ".directory-header .action-buttons",
    ".directory-header",
    ".header-actions",
    "header"
  ].map((selector) => root.querySelector(selector)).find(Boolean);
  if (!target) return;

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute(`data-${MODULE_ID}-button`, "");
  button.className = "pf2e-creature-forge-open";
  button.innerHTML = `<i class="fa-solid fa-dragon"></i> ${localize("PF2E_CREATURE_FORGE.Open", "Creature Forge")}`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openCreatureForge();
  });
  target.append(button);
}

export function initializeCreatureForgeUi() {
  Hooks.on("renderActorDirectory", injectButton);
  Hooks.on("renderSidebarTab", injectButton);
  const current = document.querySelector("#actors, .actors-directory");
  if (current) injectButton({ tabName: "actors" }, current);
  console.info(`${MODULE_ID} | Creature Forge UI integration initialized.`);
}
