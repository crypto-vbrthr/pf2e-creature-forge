import { MODULE_ID } from "../constants.js";
import { format, localize } from "../i18n.js";
import { summarizeDeferredLoot } from "./loot-runtime.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function rootElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

function actorFromApplication(application) {
  const candidate = application?.actor ?? application?.document ?? application?.object ?? null;
  if (!candidate || candidate.documentName !== "Actor" && candidate.constructor?.metadata?.name !== "Actor") return null;
  return candidate;
}

function actorByRecord(record) {
  const id = record?.actorId;
  return id ? globalThis.game?.actors?.get?.(id) ?? null : null;
}

function numberLabel(value) {
  const number = Number(value ?? 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.00$/, "");
}

function detailLabel(channel, data) {
  const countKey = data.itemCount === 1 ? "PF2E_CREATURE_FORGE.Loot.Ui.ItemSingular" : "PF2E_CREATURE_FORGE.Loot.Ui.ItemPlural";
  const countFallback = data.itemCount === 1 ? "item" : "items";
  return `${data.itemCount} ${localize(countKey, countFallback)} · ${numberLabel(data.valueGp)} ${localize("PF2E_CREATURE_FORGE.Loot.Ui.CurrencyGp", "gp")}`;
}

function button({ action, channel, icon, label, disabled = false }) {
  return `<button type="button" data-cf-deferred-action="${escapeHtml(action)}" data-cf-deferred-channel="${escapeHtml(channel)}" ${disabled ? "disabled" : ""}><i class="fa-solid ${escapeHtml(icon)}"></i> ${escapeHtml(label)}</button>`;
}

function buildPanel(actor) {
  const blueprint = actor?.flags?.[MODULE_ID]?.blueprint;
  const summary = summarizeDeferredLoot(blueprint);
  if (!summary.salvage.available && !summary.hoard.available) return null;

  const materialized = actor?.flags?.[MODULE_ID]?.loot?.materialized ?? {};
  const salvageActor = actorByRecord(materialized.salvage);
  const hoardActor = actorByRecord(materialized.hoard);
  const sameActor = salvageActor && hoardActor && salvageActor.id === hoardActor.id ? salvageActor : null;

  const rows = [];
  if (summary.salvage.available) {
    const actions = salvageActor
      ? button({ action: "open", channel: "salvage", icon: "fa-box-open", label: localize("PF2E_CREATURE_FORGE.Loot.Ui.OpenSalvage", "Open salvage") })
      : button({ action: "create", channel: "salvage", icon: "fa-hammer", label: materialized.salvage ? localize("PF2E_CREATURE_FORGE.Loot.Ui.RecreateSalvage", "Recreate salvage") : localize("PF2E_CREATURE_FORGE.Loot.Ui.CreateSalvage", "Create salvage") });
    rows.push(`<div class="cf-deferred-loot-row" data-cf-deferred-row="salvage"><div><strong>${escapeHtml(localize("PF2E_CREATURE_FORGE.Loot.Channel.salvage", "Body salvage"))}</strong><small>${escapeHtml(detailLabel("salvage", summary.salvage))}${materialized.salvage && !salvageActor ? ` · ${escapeHtml(localize("PF2E_CREATURE_FORGE.Loot.Ui.MissingActor", "previous Loot Actor missing"))}` : ""}</small></div><div class="cf-deferred-loot-actions">${actions}</div></div>`);
  }
  if (summary.hoard.available) {
    const actions = hoardActor
      ? button({ action: "open", channel: "hoard", icon: "fa-box-open", label: localize("PF2E_CREATURE_FORGE.Loot.Ui.OpenHoard", "Open hoard") })
      : button({ action: "create", channel: "hoard", icon: "fa-coins", label: materialized.hoard ? localize("PF2E_CREATURE_FORGE.Loot.Ui.RecreateHoard", "Recreate hoard") : localize("PF2E_CREATURE_FORGE.Loot.Ui.CreateHoard", "Create hoard") });
    rows.push(`<div class="cf-deferred-loot-row" data-cf-deferred-row="hoard"><div><strong>${escapeHtml(localize("PF2E_CREATURE_FORGE.Loot.Channel.hoard", "Hoard / environment"))}</strong><small>${escapeHtml(detailLabel("hoard", summary.hoard))}${materialized.hoard && !hoardActor ? ` · ${escapeHtml(localize("PF2E_CREATURE_FORGE.Loot.Ui.MissingActor", "previous Loot Actor missing"))}` : ""}</small></div><div class="cf-deferred-loot-actions">${actions}</div></div>`);
  }

  let footer = "";
  if (sameActor) {
    footer = `<div class="cf-deferred-loot-footer">${button({ action: "open", channel: "both", icon: "fa-box-open", label: localize("PF2E_CREATURE_FORGE.Loot.Ui.OpenCombined", "Open loot") })}</div>`;
  } else if (summary.salvage.available && summary.hoard.available && !salvageActor && !hoardActor && !materialized.salvage && !materialized.hoard) {
    footer = `<div class="cf-deferred-loot-footer">${button({ action: "create", channel: "both", icon: "fa-boxes-stacked", label: localize("PF2E_CREATURE_FORGE.Loot.Ui.CreateCombined", "Create combined loot") })}</div>`;
  }

  return `<section class="cf-deferred-loot-panel" data-cf-deferred-loot-panel>
    <header><div><i class="fa-solid fa-box-open"></i><strong>${escapeHtml(localize("PF2E_CREATURE_FORGE.Loot.Ui.Title", "Creature Forge loot"))}</strong></div><small>${escapeHtml(localize("PF2E_CREATURE_FORGE.Loot.Ui.Hint", "Deferred loot is prepared but is not carried by this NPC."))}</small></header>
    <div class="cf-deferred-loot-rows">${rows.join("")}</div>${footer}
  </section>`;
}

async function openActor(actor) {
  if (!actor?.sheet?.render) return;
  await actor.sheet.render({ force: true });
}

export function initializeLootRuntimeUi({ createDeferredLootActor } = {}) {
  if (!globalThis.Hooks?.on || typeof createDeferredLootActor !== "function") return;
  const busy = new Set();

  const render = (application, html) => {
    const actor = actorFromApplication(application);
    if (!actor || actor.type !== "npc" || !globalThis.game?.user?.isGM) return;
    const blueprint = actor?.flags?.[MODULE_ID]?.blueprint;
    if (!blueprint?.loot) return;
    const root = rootElement(html);
    if (!root || root.querySelector?.("[data-cf-deferred-loot-panel]")) return;
    const markup = buildPanel(actor);
    if (!markup) return;

    const form = root.matches?.("form") ? root : root.querySelector?.("form");
    const host = form ?? root;
    host.insertAdjacentHTML?.("afterbegin", markup);
    const panel = host.querySelector?.("[data-cf-deferred-loot-panel]");
    if (!(panel instanceof HTMLElement)) return;

    panel.addEventListener("click", async (event) => {
      const target = event.target?.closest?.("[data-cf-deferred-action]");
      if (!(target instanceof HTMLElement)) return;
      event.preventDefault();
      event.stopPropagation();
      const action = target.dataset.cfDeferredAction;
      const channel = target.dataset.cfDeferredChannel;
      const key = `${actor.id}:${channel}`;
      if (busy.has(key)) return;

      const materialized = actor?.flags?.[MODULE_ID]?.loot?.materialized ?? {};
      if (action === "open") {
        const record = channel === "both" ? (materialized.salvage ?? materialized.hoard) : materialized[channel];
        const lootActor = actorByRecord(record);
        if (lootActor) await openActor(lootActor);
        else globalThis.ui?.notifications?.warn?.(localize("PF2E_CREATURE_FORGE.Loot.Ui.ActorMissing", "The previously created Loot Actor no longer exists."));
        return;
      }

      if (action !== "create") return;
      busy.add(key);
      target.setAttribute("disabled", "");
      try {
        const includeSalvage = channel === "salvage" || channel === "both";
        const includeHoard = channel === "hoard" || channel === "both";
        const created = await createDeferredLootActor(actor, { includeSalvage, includeHoard });
        globalThis.ui?.notifications?.info?.(format("PF2E_CREATURE_FORGE.Loot.Ui.Created", { name: created?.name ?? "" }, `Created ${created?.name ?? "loot"}.`));
        await openActor(created);
        await application?.render?.(false);
      } catch (error) {
        console.error(`${MODULE_ID} | Deferred loot creation failed.`, error);
        globalThis.ui?.notifications?.error?.(localize("PF2E_CREATURE_FORGE.Loot.Ui.CreateFailed", "Deferred loot could not be created."));
        target.removeAttribute("disabled");
      } finally {
        busy.delete(key);
      }
    });
  };

  // PF2e v8.x runs on Foundry v14 and uses ApplicationV2 actor sheets. The V1
  // hook remains as a compatibility fallback for alternate/legacy Actor sheets.
  Hooks.on("renderApplicationV2", render);
  Hooks.on("renderApplicationV1", render);
}
