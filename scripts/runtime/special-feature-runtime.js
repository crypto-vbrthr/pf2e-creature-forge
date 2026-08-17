import { MODULE_ID } from "../constants.js";
import { buildAfflictionDescription } from "../core/compiler.js";
import { localize, format } from "../i18n.js";
import { localizeAuraResourceDefinition, localizeAfflictionResourceDefinition } from "../special-feature-localization.js";

function actorBlueprint(actor) { return actor?.flags?.[MODULE_ID]?.blueprint ?? null; }
function itemsOf(actor) { try { return actor?.items ? [...actor.items] : []; } catch { return []; } }
function selectedTargets() { try { return [...(globalThis.game?.user?.targets ?? [])]; } catch { return []; } }

function localizedAura(resource) { return localizeAuraResourceDefinition(resource); }
function localizedAffliction(resource) { return localizeAfflictionResourceDefinition(resource); }

export class CreatureSpecialFeatureRuntime {
  constructor({ integrations }) { this.integrations = integrations; }

  get auraAvailable() { return typeof this.integrations?.auraApi?.instances?.assignDefinition === "function"; }
  get afflictionAvailable() { return typeof this.integrations?.afflictionApi?.engine?.applyDefinition === "function"; }

  async cleanupAuras(actor) {
    const api = this.integrations?.auraApi;
    if (!actor || !api?.instances?.list || !api?.instances?.remove) return [];
    const removed = [];
    for (const instance of api.instances.list(actor) ?? []) {
      let resolved = null;
      try { resolved = api.instances.resolve?.(actor, instance.id) ?? null; } catch { resolved = null; }
      const definition = resolved?.definition ?? instance?.definitionSnapshot ?? null;
      const id = String(definition?.id ?? instance?.definitionId ?? "");
      const owned = instance?.definitionScope === "actor" && (id.startsWith(`${MODULE_ID}.`) || definition?.metadata?.createdBy === MODULE_ID || definition?.metadata?.originModule === MODULE_ID);
      if (!owned) continue;
      try { removed.push(await api.instances.remove(actor, instance.id)); } catch (error) { console.warn(`${MODULE_ID} | Could not remove actor-local generated aura.`, error); }
    }
    return removed;
  }

  async materializeAuras(actor, blueprint = actorBlueprint(actor)) {
    const result = { available: this.auraAvailable, assigned: [], warnings: [] };
    if (!actor || !blueprint) return result;
    await this.cleanupAuras(actor);
    if (!this.auraAvailable) return result;
    for (const resource of blueprint.resources?.auras ?? []) {
      try {
        const definition = localizedAura(resource);
        const assigned = await this.integrations.auraApi.instances.assignDefinition(actor, definition, { enabled: true });
        result.assigned.push({ auraRef: resource.id, instanceId: assigned?.id ?? null, definitionId: definition.id });
      } catch (error) {
        result.warnings.push({ auraRef: resource.id, message: error?.message ?? String(error) });
        console.warn(`${MODULE_ID} | Aura materialization failed for ${resource.id}.`, error);
      }
    }
    return result;
  }

  async updateAfflictionDescriptions(actor, blueprint = actorBlueprint(actor)) {
    if (!actor || !blueprint) return [];
    const resources = new Map((blueprint.resources?.afflictions ?? []).map((entry) => [entry.id, entry]));
    const updates = [];
    for (const item of itemsOf(actor)) {
      const ref = item?.flags?.[MODULE_ID]?.afflictionRef;
      const resource = ref ? resources.get(ref) : null;
      if (!resource) continue;
      updates.push({
        _id: item.id,
        "system.description.value": buildAfflictionDescription(resource, { actorUuid: actor.uuid, runtimeAvailable: this.afflictionAvailable })
      });
    }
    if (!updates.length) return [];
    if (typeof actor.updateEmbeddedDocuments === "function") return actor.updateEmbeddedDocuments("Item", updates, { render: false });
    const changed = [];
    for (const update of updates) {
      const item = itemsOf(actor).find((entry) => entry.id === update._id);
      if (item?.update) changed.push(await item.update(update, { render: false }));
    }
    return changed;
  }

  async applyAffliction({ actor, afflictionRef, targets = null } = {}) {
    if (!this.afflictionAvailable) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.AfflictionForgeUnavailable", "Affliction Forge integration is unavailable."));
    const blueprint = actorBlueprint(actor);
    const resource = blueprint?.resources?.afflictions?.find((entry) => entry.id === afflictionRef || entry.contentId === afflictionRef);
    if (!resource) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.AfflictionDefinitionMissing", "The linked affliction definition could not be found."));
    const resolvedTargets = targets ? (Array.isArray(targets) ? targets : [targets]) : selectedTargets();
    if (!resolvedTargets.length) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.NoTargets", "Select at least one target before applying this affliction."));
    const definition = localizedAffliction(resource);
    const result = await this.integrations.afflictionApi.engine.applyDefinition(definition, resolvedTargets, {
      sourceActorUuid: actor?.uuid ?? null,
      sourceActor: actor,
      creatureForge: { actorUuid: actor?.uuid ?? null, afflictionRef: resource.id }
    });
    return { result, actor, resource, targets: resolvedTargets };
  }

  async initializeActor(actor, blueprint = actorBlueprint(actor)) {
    const auras = await this.materializeAuras(actor, blueprint);
    const updatedAfflictions = await this.updateAfflictionDescriptions(actor, blueprint);
    return { actor, auras, updatedAfflictions, afflictionAvailable: this.afflictionAvailable };
  }
}

let uiInitialized = false;
export function initializeSpecialFeatureRuntimeUi(runtime) {
  if (uiInitialized) return;
  uiInitialized = true;
  globalThis.document?.addEventListener?.("click", async (event) => {
    const button = event.target?.closest?.(".pf2e-creature-forge-apply-affliction");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const actorUuid = button.dataset.cfActorUuid;
    const afflictionRef = button.dataset.cfAfflictionRef;
    try {
      button.disabled = true;
      const actor = await (globalThis.fromUuid?.(actorUuid) ?? null);
      if (!actor) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.ActorMissing", "The source creature could not be found."));
      const applied = await runtime.applyAffliction({ actor, afflictionRef });
      const name = localize(applied.resource?.nameKey, applied.resource?.definition?.name ?? applied.resource?.name ?? afflictionRef);
      globalThis.ui?.notifications?.info?.(format("PF2E_CREATURE_FORGE.Runtime.AfflictionApplied", { name, count: applied.targets.length }, `${name} applied to ${applied.targets.length} target(s).`));
    } catch (error) {
      console.error(`${MODULE_ID} | Manual affliction application failed.`, error);
      globalThis.ui?.notifications?.error?.(error?.message ?? localize("PF2E_CREATURE_FORGE.Runtime.AfflictionApplyFailed", "The affliction could not be applied."));
    } finally {
      button.disabled = false;
    }
  }, true);
}
