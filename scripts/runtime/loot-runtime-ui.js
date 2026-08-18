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

function detailLabel(data) {
  const countKey = data.itemCount === 1 ? "PF2E_CREATURE_FORGE.Loot.Ui.ItemSingular" : "PF2E_CREATURE_FORGE.Loot.Ui.ItemPlural";
  const countFallback = data.itemCount === 1 ? "item" : "items";
  return `${data.itemCount} ${localize(countKey, countFallback)} · ${numberLabel(data.valueGp)} ${localize("PF2E_CREATURE_FORGE.Loot.Ui.CurrencyGp", "gp")}`;
}

function hasDeferredLoot(actor) {
  const blueprint = actor?.flags?.[MODULE_ID]?.blueprint;
  const summary = summarizeDeferredLoot(blueprint);
  return Boolean(summary.salvage.available || summary.hoard.available);
}

function buildDialogContent(actor) {
  const blueprint = actor?.flags?.[MODULE_ID]?.blueprint;
  const summary = summarizeDeferredLoot(blueprint);
  const materialized = actor?.flags?.[MODULE_ID]?.loot?.materialized ?? {};
  const salvageActor = actorByRecord(materialized.salvage);
  const hoardActor = actorByRecord(materialized.hoard);
  const rows = [];

  if (summary.salvage.available) {
    const state = salvageActor
      ? localize("PF2E_CREATURE_FORGE.Loot.Ui.Materialized", "Loot Actor created")
      : materialized.salvage
        ? localize("PF2E_CREATURE_FORGE.Loot.Ui.MissingActor", "previous Loot Actor missing")
        : localize("PF2E_CREATURE_FORGE.Loot.Ui.Prepared", "prepared");
    rows.push(`<div class="cf-deferred-loot-dialog-row">
      <div><strong>${escapeHtml(localize("PF2E_CREATURE_FORGE.Loot.Channel.salvage", "Body salvage"))}</strong><small>${escapeHtml(detailLabel(summary.salvage))}</small></div>
      <span>${escapeHtml(state)}</span>
    </div>`);
  }

  if (summary.hoard.available) {
    const state = hoardActor
      ? localize("PF2E_CREATURE_FORGE.Loot.Ui.Materialized", "Loot Actor created")
      : materialized.hoard
        ? localize("PF2E_CREATURE_FORGE.Loot.Ui.MissingActor", "previous Loot Actor missing")
        : localize("PF2E_CREATURE_FORGE.Loot.Ui.Prepared", "prepared");
    rows.push(`<div class="cf-deferred-loot-dialog-row">
      <div><strong>${escapeHtml(localize("PF2E_CREATURE_FORGE.Loot.Channel.hoard", "Hoard / environment"))}</strong><small>${escapeHtml(detailLabel(summary.hoard))}</small></div>
      <span>${escapeHtml(state)}</span>
    </div>`);
  }

  return `<div class="cf-deferred-loot-dialog-content">
    <p>${escapeHtml(localize("PF2E_CREATURE_FORGE.Loot.Ui.Hint", "Deferred loot is prepared but is not carried by this NPC."))}</p>
    <div class="cf-deferred-loot-dialog-rows">${rows.join("")}</div>
  </div>`;
}

async function openActor(actor) {
  if (!actor?.sheet?.render) return false;
  try {
    await actor.sheet.render({ force: true });
    return true;
  } catch (error) {
    console.warn(`${MODULE_ID} | Loot Actor was created but its sheet could not be opened automatically.`, error);
    return false;
  }
}

async function createLoot(actor, channel, createDeferredLootActor) {
  try {
    const includeSalvage = channel === "salvage" || channel === "both";
    const includeHoard = channel === "hoard" || channel === "both";
    const created = await createDeferredLootActor(actor, { includeSalvage, includeHoard });
    globalThis.ui?.notifications?.info?.(format(
      "PF2E_CREATURE_FORGE.Loot.Ui.Created",
      { name: created?.name ?? "" },
      `Created ${created?.name ?? "loot"}.`
    ));
    await openActor(created);
    return created;
  } catch (error) {
    console.error(`${MODULE_ID} | Deferred loot creation failed.`, error);
    const detail = error?.message ? ` (${error.message})` : "";
    globalThis.ui?.notifications?.error?.(`${localize("PF2E_CREATURE_FORGE.Loot.Ui.CreateFailed", "Deferred loot could not be created.")}${detail}`);
    return null;
  }
}

async function openRecordedLoot(actor, channel) {
  const materialized = actor?.flags?.[MODULE_ID]?.loot?.materialized ?? {};
  const record = channel === "both" ? (materialized.salvage ?? materialized.hoard) : materialized[channel];
  const lootActor = actorByRecord(record);
  if (lootActor) return openActor(lootActor);
  globalThis.ui?.notifications?.warn?.(localize(
    "PF2E_CREATURE_FORGE.Loot.Ui.ActorMissing",
    "The previously created Loot Actor no longer exists."
  ));
  return false;
}

function dialogButtons(actor, createDeferredLootActor) {
  const blueprint = actor?.flags?.[MODULE_ID]?.blueprint;
  const summary = summarizeDeferredLoot(blueprint);
  const materialized = actor?.flags?.[MODULE_ID]?.loot?.materialized ?? {};
  const salvageActor = actorByRecord(materialized.salvage);
  const hoardActor = actorByRecord(materialized.hoard);
  const buttons = [];

  if (summary.salvage.available) {
    buttons.push(salvageActor ? {
      action: "open-salvage",
      label: localize("PF2E_CREATURE_FORGE.Loot.Ui.OpenSalvage", "Open salvage"),
      icon: "fa-solid fa-box-open",
      callback: () => openRecordedLoot(actor, "salvage")
    } : {
      action: "create-salvage",
      label: materialized.salvage
        ? localize("PF2E_CREATURE_FORGE.Loot.Ui.RecreateSalvage", "Recreate salvage")
        : localize("PF2E_CREATURE_FORGE.Loot.Ui.CreateSalvage", "Create salvage"),
      icon: "fa-solid fa-hammer",
      callback: () => createLoot(actor, "salvage", createDeferredLootActor)
    });
  }

  if (summary.hoard.available) {
    buttons.push(hoardActor ? {
      action: "open-hoard",
      label: localize("PF2E_CREATURE_FORGE.Loot.Ui.OpenHoard", "Open hoard"),
      icon: "fa-solid fa-box-open",
      callback: () => openRecordedLoot(actor, "hoard")
    } : {
      action: "create-hoard",
      label: materialized.hoard
        ? localize("PF2E_CREATURE_FORGE.Loot.Ui.RecreateHoard", "Recreate hoard")
        : localize("PF2E_CREATURE_FORGE.Loot.Ui.CreateHoard", "Create hoard"),
      icon: "fa-solid fa-coins",
      callback: () => createLoot(actor, "hoard", createDeferredLootActor)
    });
  }

  if (summary.salvage.available && summary.hoard.available && !salvageActor && !hoardActor && !materialized.salvage && !materialized.hoard) {
    buttons.push({
      action: "create-both",
      label: localize("PF2E_CREATURE_FORGE.Loot.Ui.CreateCombined", "Create loot"),
      icon: "fa-solid fa-boxes-stacked",
      callback: () => createLoot(actor, "both", createDeferredLootActor)
    });
  }

  buttons.push({
    action: "close",
    label: localize("PF2E_CREATURE_FORGE.Loot.Ui.Close", "Close"),
    icon: "fa-solid fa-xmark"
  });

  return buttons;
}

function openLootDialog(actor, createDeferredLootActor) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2) {
    console.error(`${MODULE_ID} | Foundry DialogV2 is unavailable; deferred-loot dialog cannot be opened.`);
    globalThis.ui?.notifications?.error?.(localize(
      "PF2E_CREATURE_FORGE.Loot.Ui.DialogUnavailable",
      "The loot window could not be opened."
    ));
    return null;
  }

  const dialog = new DialogV2({
    id: `${MODULE_ID}-deferred-loot-${actor.id}`,
    classes: ["pf2e-creature-forge", "cf-deferred-loot-dialog"],
    window: {
      title: localize("PF2E_CREATURE_FORGE.Loot.Ui.Title", "Creature Forge loot"),
      icon: "fa-solid fa-box-open",
      resizable: false
    },
    position: { width: 560 },
    modal: false,
    content: buildDialogContent(actor),
    buttons: dialogButtons(actor, createDeferredLootActor)
  });
  dialog.render({ force: true });
  return dialog;
}

export function initializeLootRuntimeUi({ createDeferredLootActor } = {}) {
  if (!globalThis.Hooks?.on || typeof createDeferredLootActor !== "function") return;

  // Deferred loot deliberately lives in its own Foundry dialog. Injecting a
  // section into PF2e 8.4's legacy NPC form changes that form's grid children
  // and can destroy the sheet layout. The actor sheet therefore only receives
  // a header control; its DOM/content is never modified by Creature Forge.
  const openForApplication = (application) => {
    const actor = actorFromApplication(application);
    if (!actor || actor.type !== "npc" || !globalThis.game?.user?.isGM || !hasDeferredLoot(actor)) return null;
    return openLootDialog(actor, createDeferredLootActor);
  };

  Hooks.on("getHeaderControlsApplicationV2", (application, controls) => {
    const actor = actorFromApplication(application);
    if (!actor || actor.type !== "npc" || !globalThis.game?.user?.isGM || !hasDeferredLoot(actor)) return;
    if (controls.some?.((entry) => entry?.action === "pf2e-creature-forge-loot")) return;
    controls.unshift({
      action: "pf2e-creature-forge-loot",
      label: localize("PF2E_CREATURE_FORGE.Loot.Ui.HeaderControl", "Loot"),
      icon: "fa-solid fa-box-open",
      visible: true,
      onClick: () => openForApplication(application)
    });
  });

  const addV1HeaderButton = (application, buttons) => {
    const actor = actorFromApplication(application);
    if (!actor || actor.type !== "npc" || !globalThis.game?.user?.isGM || !hasDeferredLoot(actor)) return;
    if (buttons.some?.((entry) => entry?.class === "pf2e-creature-forge-loot")) return;
    buttons.unshift({
      label: localize("PF2E_CREATURE_FORGE.Loot.Ui.HeaderControl", "Loot"),
      class: "pf2e-creature-forge-loot",
      icon: "fas fa-box-open",
      onclick: () => openForApplication(application)
    });
  };

  // PF2e 8.4's NPC sheet is still ApplicationV1 on Foundry v14, while other
  // sheets may use ApplicationV2. Register header hooks only. No render hook is
  // needed because Creature Forge no longer mutates the actor-sheet markup.
  Hooks.on("getApplicationV1HeaderButtons", addV1HeaderButton);
  Hooks.on("getApplicationHeaderButtons", addV1HeaderButton);
  Hooks.on("getActorSheetHeaderButtons", addV1HeaderButton);
}
