import { MODULE_ID } from "../constants.js";
import { deepClone } from "../core/clone.js";
import { buildAbilityDescription, preserveAfflictionHostBlock } from "../core/compiler.js";
import { localize, format } from "../i18n.js";

const RESOURCE_FOLDER_NAME = "PF2E Creature Forge – Runtime Effects";

function itemsOf(actor) {
  if (!actor?.items) return [];
  if (Array.isArray(actor.items)) return actor.items;
  try { return [...actor.items]; } catch { return []; }
}

function worldItems() {
  const items = globalThis.game?.items;
  if (!items) return [];
  if (typeof items.filter === "function") return [...items.filter(() => true)];
  try { return [...items]; } catch { return []; }
}

function worldFolders() {
  const folders = globalThis.game?.folders;
  if (!folders) return [];
  if (typeof folders.filter === "function") return [...folders.filter(() => true)];
  try { return [...folders]; } catch { return []; }
}

function actorLevel(actor) {
  return Number(actor?.level ?? actor?.system?.details?.level?.value ?? 0);
}

function actorBlueprint(actor) {
  return actor?.flags?.[MODULE_ID]?.blueprint ?? null;
}

function effectResource(blueprint, effectRef) {
  return blueprint?.resources?.effects?.find?.((entry) => entry.id === effectRef || entry.contentId === effectRef) ?? null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function localizedAbilityName(ability) {
  if (!ability) return "";
  return localize(ability.nameKey, ability.name ?? ability.contentId ?? ability.id ?? "");
}

function localizedEffectDefinition(resource, { ability = null, includeSource = false } = {}) {
  const definition = deepClone(resource?.definition ?? null);
  if (!definition) return null;
  const localizedName = localize(resource?.nameKey, definition?.name ?? resource?.name ?? resource?.id ?? "Effect");
  if (localizedName) definition.name = localizedName;

  // An explicitly edited description always wins. Core/external content may instead
  // provide a locale-neutral descriptionKey, which is resolved only at presentation
  // and application time so the Blueprint itself remains language-independent.
  const existingDescription = String(definition.description ?? "").trim();
  if (!existingDescription) {
    const descriptionKey = resource?.descriptionKey ?? definition?.metadata?.descriptionKey ?? null;
    if (descriptionKey) {
      const localizedDescription = localize(descriptionKey, "");
      if (localizedDescription && localizedDescription !== descriptionKey) definition.description = localizedDescription;
    }
  }

  if (includeSource && ability) {
    const abilityName = localizedAbilityName(ability);
    if (abilityName) {
      const sourceLabel = localize("PF2E_CREATURE_FORGE.Runtime.EffectSource", "Source");
      const sourceNote = `<p class="pf2e-creature-forge-effect-source"><strong>${escapeHtml(sourceLabel)}:</strong> ${escapeHtml(abilityName)}</p>`;
      definition.description = `${String(definition.description ?? "").trim()}${sourceNote}`;
    }
  }
  return definition;
}

function abilityDefinition(blueprint, abilityId) {
  return blueprint?.abilities?.find?.((entry) => entry.id === abilityId) ?? null;
}

function uniqueTargets(targets) {
  const result = [];
  const seen = new Set();
  for (const target of targets ?? []) {
    const actor = target?.documentName === "Actor" ? target : target?.actor ?? target?.document?.actor ?? null;
    const key = actor?.uuid ?? actor?.id ?? target?.uuid ?? target?.id ?? target;
    if (!target || seen.has(key)) continue;
    seen.add(key);
    result.push(target);
  }
  return result;
}

function selectedTargets() {
  const targets = globalThis.game?.user?.targets;
  if (!targets) return [];
  try { return [...targets]; } catch { return []; }
}

function targetModeIsPlural(mode) {
  return ["targets", "failed-save-targets", "selected-targets", "all-selected", "area"].includes(mode);
}

async function ensureResourceFolder() {
  let folder = worldFolders().find((entry) =>
    entry?.type === "Item" && entry?.flags?.[MODULE_ID]?.runtimeEffectResources === true
  );
  if (folder) return folder;
  if (!globalThis.Folder?.create) return null;
  try {
    folder = await globalThis.Folder.create({
      name: RESOURCE_FOLDER_NAME,
      type: "Item",
      sorting: "a",
      flags: { [MODULE_ID]: { runtimeEffectResources: true } }
    });
    return folder ?? null;
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not create runtime effect resource folder.`, error);
    return null;
  }
}

async function tagMaterializedItem(item, { actor, resource, folder, segmentIndex = 0 }) {
  if (!item?.update) return item;
  const update = {
    [`flags.${MODULE_ID}.runtimeResource`]: {
      kind: "effect",
      actorUuid: actor?.uuid ?? null,
      actorId: actor?.id ?? null,
      effectRef: resource.id,
      contentId: resource.contentId ?? resource.id,
      segmentIndex
    }
  };
  if (folder?.id) update.folder = folder.id;
  try { await item.update(update, { render: false }); } catch (error) {
    console.warn(`${MODULE_ID} | Could not tag runtime effect resource item.`, error);
  }
  return item;
}

export class CreatureEffectRuntime {
  constructor({ integrations }) {
    this.integrations = integrations;
  }

  get available() {
    return typeof this.integrations?.effectApi?.effects?.apply === "function";
  }

  get materializationAvailable() {
    return typeof this.integrations?.effectApi?.effects?.createItems === "function";
  }

  resolve(actor, { abilityId = null, effectRef = null, applicationIndex = null } = {}) {
    const blueprint = actorBlueprint(actor);
    if (!blueprint) return { actor, blueprint: null, ability: null, application: null, resource: null, definition: null };
    const ability = abilityId ? abilityDefinition(blueprint, abilityId) : null;
    let application = null;
    if (ability) {
      if (Number.isInteger(applicationIndex)) application = ability.applications?.[applicationIndex] ?? null;
      if (!application && effectRef) application = ability.applications?.find?.((entry) => entry.type === "effect" && entry.ref === effectRef) ?? null;
      if (!application) application = ability.applications?.find?.((entry) => entry.type === "effect") ?? null;
    }
    const ref = effectRef ?? application?.ref ?? null;
    const resource = ref ? effectResource(blueprint, ref) : null;
    return { actor, blueprint, ability, application, resource, definition: resource?.definition ?? null };
  }

  resolveTargets(actor, targetMode = "target", explicitTargets = null) {
    if (explicitTargets) return uniqueTargets(Array.isArray(explicitTargets) ? explicitTargets : [explicitTargets]);
    if (targetMode === "self") return actor ? [actor] : [];
    const selected = uniqueTargets(selectedTargets());
    return targetModeIsPlural(targetMode) ? selected : selected.slice(0, 1);
  }

  async apply({ actor, abilityId = null, effectRef = null, applicationIndex = null, targets = null } = {}) {
    if (!this.available) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.EffectForgeUnavailable", "Effect Forge integration is unavailable."));
    const resolved = this.resolve(actor, { abilityId, effectRef, applicationIndex });
    if (!resolved.definition) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.EffectDefinitionMissing", "The linked effect definition could not be found."));
    const mode = resolved.application?.target ?? "target";
    const resolvedTargets = this.resolveTargets(actor, mode, targets);
    if (!resolvedTargets.length) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.NoTargets", "Select at least one target before applying this effect."));

    const localizedDefinition = localizedEffectDefinition(resolved.resource, { ability: resolved.ability, includeSource: true }) ?? deepClone(resolved.definition);
    const created = await this.integrations.effectApi.effects.apply(localizedDefinition, resolvedTargets, {
      context: {
        actor,
        origin: actor,
        sourceActor: actor,
        level: actorLevel(actor),
        creatureForge: {
          actorUuid: actor?.uuid ?? null,
          abilityId: resolved.ability?.id ?? abilityId,
          effectRef: resolved.resource?.id ?? effectRef,
          timing: resolved.application?.timing ?? null,
          target: mode
        }
      }
    });
    return {
      created,
      targets: resolvedTargets,
      actor,
      ability: resolved.ability,
      application: resolved.application,
      resource: resolved.resource
    };
  }

  async cleanupActorResources(actor) {
    const actorUuid = actor?.uuid;
    if (!actorUuid) return [];
    const resources = worldItems().filter((item) => item?.flags?.[MODULE_ID]?.runtimeResource?.actorUuid === actorUuid);
    const removed = [];
    for (const item of resources) {
      if (typeof item?.delete !== "function") continue;
      try { removed.push(await item.delete({ render: false })); } catch (error) {
        console.warn(`${MODULE_ID} | Could not delete runtime effect resource ${item?.uuid ?? item?.id}.`, error);
      }
    }
    return removed;
  }

  async materialize(actor, blueprint = actorBlueprint(actor)) {
    const result = { available: this.materializationAvailable, resources: {}, warnings: [] };
    if (!actor || !blueprint) return result;

    await this.cleanupActorResources(actor);
    const referenced = new Set((blueprint.abilities ?? []).flatMap((ability) => (ability.applications ?? [])
      .filter((entry) => entry.type === "effect" && entry.ref)
      .map((entry) => entry.ref)));
    const resources = (blueprint.resources?.effects ?? []).filter((entry) => referenced.has(entry.id) || referenced.has(entry.contentId));
    const folder = this.materializationAvailable ? await ensureResourceFolder() : null;

    for (const resource of resources) {
      const record = {
        effectRef: resource.id,
        contentId: resource.contentId ?? resource.id,
        primaryUuid: null,
        uuids: [],
        instantOnly: false,
        materialized: false
      };
      result.resources[resource.id] = record;
      if (!this.materializationAvailable) continue;
      try {
        const materializedDefinition = localizedEffectDefinition(resource);
        const created = await this.integrations.effectApi.effects.createItems(materializedDefinition, {
          renderSheet: false,
          context: {
            actor,
            origin: actor,
            sourceActor: actor,
            level: actorLevel(actor)
          }
        });
        const list = Array.isArray(created) ? created : (created ? [created] : []);
        for (const [index, item] of list.entries()) {
          await tagMaterializedItem(item, { actor, resource, folder, segmentIndex: index });
        }
        record.uuids = list.map((item) => item?.uuid).filter(Boolean);
        record.primaryUuid = record.uuids[0] ?? null;
        record.materialized = record.uuids.length > 0;
        record.instantOnly = list.length === 0;
      } catch (error) {
        result.warnings.push({ effectRef: resource.id, message: error?.message ?? String(error) });
        console.warn(`${MODULE_ID} | Effect resource materialization failed for ${resource.id}.`, error);
      }
    }

    return result;
  }

  async updateAbilityDescriptions(actor, blueprint = actorBlueprint(actor), materialization = null) {
    if (!actor || !blueprint) return [];
    const effectResources = new Map((blueprint.resources?.effects ?? []).map((resource) => [resource.id, resource]));
    const runtimeLinks = materialization?.resources ?? actor?.flags?.[MODULE_ID]?.runtime?.effects ?? {};
    const abilityById = new Map((blueprint.abilities ?? []).map((ability) => [ability.id, ability]));
    const updates = [];

    for (const item of itemsOf(actor)) {
      const abilityId = item?.flags?.[MODULE_ID]?.abilityId;
      if (!abilityId) continue;
      const ability = abilityById.get(abilityId);
      if (!ability) continue;
      const rebuilt = buildAbilityDescription(ability, effectResources, {
        runtimeLinks,
        actorUuid: actor.uuid,
        runtimeAvailable: this.available
      });
      updates.push({
        _id: item.id,
        // Affliction delivery is authored by the special-feature runtime after the
        // base ability description. Effect refreshes must not erase that verified
        // host block when an ability is both effect-backed and an Affliction carrier.
        "system.description.value": preserveAfflictionHostBlock(item.system?.description?.value ?? "", rebuilt),
        [`flags.${MODULE_ID}.runtimeEffects`]: deepClone((ability.applications ?? []).filter((entry) => entry.type === "effect"))
      });
    }

    if (!updates.length) return [];
    if (typeof actor.updateEmbeddedDocuments === "function") {
      return actor.updateEmbeddedDocuments("Item", updates, { render: false });
    }
    const changed = [];
    for (const update of updates) {
      const item = itemsOf(actor).find((entry) => entry.id === update._id);
      if (item?.update) changed.push(await item.update(update, { render: false }));
    }
    return changed;
  }

  async initializeActor(actor, blueprint = actorBlueprint(actor)) {
    if (!actor || !blueprint) return { actor, materialization: null, updatedAbilities: [] };
    const materialization = await this.materialize(actor, blueprint);
    const runtimeState = {
      schemaVersion: 1,
      effects: materialization.resources,
      materializationAvailable: materialization.available,
      applyAvailable: this.available,
      warnings: materialization.warnings
    };
    if (typeof actor.update === "function") {
      try { await actor.update({ [`flags.${MODULE_ID}.runtime`]: deepClone(runtimeState) }, { render: false }); } catch (error) {
        console.warn(`${MODULE_ID} | Could not persist Creature Forge runtime state.`, error);
      }
    }
    const updatedAbilities = await this.updateAbilityDescriptions(actor, blueprint, materialization);
    return { actor, materialization, updatedAbilities, runtimeState };
  }
}

let uiInitialized = false;

export function initializeEffectRuntimeUi(runtime) {
  if (uiInitialized) return;
  uiInitialized = true;

  if (globalThis.document?.addEventListener) {
    globalThis.document.addEventListener("click", async (event) => {
      const button = event.target?.closest?.(".pf2e-creature-forge-apply-effect");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled || button.getAttribute?.("aria-disabled") === "true") return;

      const actorUuid = button.dataset.cfActorUuid;
      const abilityId = button.dataset.cfAbilityId;
      const effectRef = button.dataset.cfEffectRef;
      const applicationIndex = Number(button.dataset.cfApplicationIndex);
      try {
        button.disabled = true;
        button.setAttribute?.("aria-disabled", "true");
        button.classList?.add?.("disabled");
        const actor = await (globalThis.fromUuid?.(actorUuid) ?? null);
        if (!actor) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.ActorMissing", "The source creature could not be found."));
        const applied = await runtime.apply({
          actor,
          abilityId,
          effectRef,
          applicationIndex: Number.isInteger(applicationIndex) ? applicationIndex : null
        });
        const effectName = localize(
          applied.resource?.nameKey,
          applied.resource?.definition?.name ?? applied.resource?.name ?? effectRef
        );
        globalThis.ui?.notifications?.info?.(format(
          "PF2E_CREATURE_FORGE.Runtime.Applied",
          { name: effectName, count: applied.targets.length },
          `${effectName} applied to ${applied.targets.length} target(s).`
        ));
      } catch (error) {
        console.error(`${MODULE_ID} | Manual effect application failed.`, error);
        globalThis.ui?.notifications?.error?.(error?.message ?? localize("PF2E_CREATURE_FORGE.Runtime.ApplyFailed", "The effect could not be applied."));
      } finally {
        button.disabled = false;
        button.removeAttribute?.("aria-disabled");
        button.classList?.remove?.("disabled");
      }
    }, { capture: true });
  }

  globalThis.Hooks?.on?.("deleteActor", (actor) => {
    runtime.cleanupActorResources(actor).catch((error) => console.warn(`${MODULE_ID} | Runtime effect cleanup failed.`, error));
  });
}
