import { MODULE_ID } from "../constants.js";
import { buildAfflictionDescription, buildAfflictionHostDescription } from "../core/compiler.js";
import { localize, format } from "../i18n.js";
import { localizeAuraResourceDefinition, localizeAfflictionResourceDefinition } from "../special-feature-localization.js";
import { definitionFingerprint } from "../integration/affliction-library-bridge.js";

function actorBlueprint(actor) { return actor?.flags?.[MODULE_ID]?.blueprint ?? null; }
function itemsOf(actor) { try { return actor?.items ? [...actor.items] : []; } catch { return []; } }
function selectedTargets() { try { return [...(globalThis.game?.user?.targets ?? [])]; } catch { return []; } }
function localizedAura(resource) { return localizeAuraResourceDefinition(resource); }
function localizedAffliction(resource) { return localizeAfflictionResourceDefinition(resource); }
function cfFlags(item) { return item?.flags?.[MODULE_ID] ?? {}; }
function affFlags(item) { return item?.flags?.["pf2e-affliction-forge"] ?? {}; }

function hostItemFor(actor, delivery = {}, blueprint = actorBlueprint(actor)) {
  if (delivery?.mode !== "hosted") return null;
  const items = itemsOf(actor);
  if (delivery.hostType === "attack") {
    const exact = items.find((item) => cfFlags(item).attackId === delivery.hostId);
    if (exact) return exact;
    // Runtime fallback: PF2e or another hook may normalize an embedded melee Item
    // before Creature Forge materializes Affliction references. Generated attacks
    // are created in blueprint order, so recover the intended host by position.
    const attackIndex = (blueprint?.combat?.attacks ?? []).findIndex((entry) => entry.id === delivery.hostId);
    const meleeItems = items.filter((item) => item?.type === "melee");
    if (attackIndex >= 0 && meleeItems[attackIndex]) return meleeItems[attackIndex];
  }
  if (delivery.hostType === "ability") {
    const exact = items.find((item) => cfFlags(item).abilityId === delivery.hostId);
    if (exact) return exact;
    const abilityIndex = (blueprint?.abilities ?? []).findIndex((entry) => entry.id === delivery.hostId);
    const abilityItems = items.filter((item) => item?.type === "action" && !cfFlags(item).afflictionRef);
    if (abilityIndex >= 0 && abilityItems[abilityIndex]) return abilityItems[abilityIndex];
  }
  return null;
}

function canonicalTemplateUuid(resource) {
  const source = resource?.source ?? {};
  const uuid = String(resource?.templateUuid ?? source.templateUuid ?? "").trim();
  if (!uuid || source.sourceKind !== "affliction-forge-library" || source.detached === true) return null;
  const expected = String(source.definitionFingerprint ?? "").trim();
  if (expected && definitionFingerprint(resource?.definition ?? {}) !== expected) return null;
  return uuid;
}

function persistedReference(api, actor, host, referenceId) {
  const fresh = actor?.items?.get?.(host?.id) ?? itemsOf(actor).find((item) => item?.id === host?.id) ?? host;
  try {
    const direct = api?.references?.get?.(fresh, referenceId);
    if (direct) return direct;
  } catch { /* fall through */ }
  try { return (api?.references?.list?.(fresh) ?? []).find((entry) => entry?.id === referenceId) ?? null; }
  catch { return null; }
}

function definitionValid(report) {
  if (!report || report.unavailable) return true;
  if (report.valid === false) return false;
  return !(report.errors?.length);
}

export class CreatureSpecialFeatureRuntime {
  constructor({ integrations }) { this.integrations = integrations; }

  get auraAvailable() { return typeof this.integrations?.auraApi?.instances?.assignDefinition === "function"; }
  get afflictionAvailable() { return typeof this.integrations?.afflictionApi?.engine?.applyDefinition === "function"; }
  get afflictionMaterializationAvailable() {
    const api = this.integrations?.afflictionApi;
    return Boolean(api?.documents?.buildTemplateSource && api?.references?.create && api?.references?.add);
  }

  async cleanupAuras(actor) {
    const api = this.integrations?.auraApi;
    if (!actor || !api?.instances?.list || !api?.instances?.remove) return [];
    const removed = [];
    for (const instance of api.instances.list(actor) ?? []) {
      let resolved = null;
      try { resolved = api.instances.resolve?.(actor, instance.id) ?? null; } catch { resolved = null; }
      const definition = resolved?.definition ?? instance?.definitionSnapshot ?? null;
      const id = String(definition?.id ?? instance?.definitionId ?? "");
      const owned = instance?.definitionScope === "actor" && (
        id.startsWith(`${MODULE_ID}.`)
        || definition?.metadata?.createdBy === MODULE_ID
        || definition?.metadata?.originModule === MODULE_ID
        || definition?.metadata?.creatureForge?.originModule === MODULE_ID
      );
      if (!owned) continue;
      try { removed.push(await api.instances.remove(actor, instance.id)); } catch (error) { console.warn(`${MODULE_ID} | Could not remove actor-local generated aura.`, error); }
    }
    return removed;
  }

  async materializeAuras(actor, blueprint = actorBlueprint(actor)) {
    const result = { available: this.auraAvailable, assigned: [], warnings: [], reconciliation: null };
    if (!actor || !blueprint) return result;
    await this.cleanupAuras(actor);
    if (!this.auraAvailable) return result;
    for (const resource of blueprint.resources?.auras ?? []) {
      try {
        const definition = localizedAura(resource);
        definition.metadata = {
          ...(definition.metadata ?? {}),
          creatureForge: {
            ...(definition.metadata?.creatureForge ?? {}),
            originModule: MODULE_ID,
            resourceId: resource.id,
            contentId: resource.contentId ?? resource.id,
            actorUuid: actor.uuid ?? null
          }
        };
        const report = this.integrations.auraApi?.definitions?.validate?.(definition);
        if (!definitionValid(report)) throw new Error((report?.errors ?? []).map((entry) => entry?.message ?? String(entry)).join(" ") || "Invalid Aura definition.");
        const assigned = await this.integrations.auraApi.instances.assignDefinition(actor, definition, { enabled: true });
        result.assigned.push({ auraRef: resource.id, instanceId: assigned?.id ?? null, definitionId: definition.id });
      } catch (error) {
        result.warnings.push({ auraRef: resource.id, message: error?.message ?? String(error) });
        console.warn(`${MODULE_ID} | Aura materialization failed for ${resource.id}.`, error);
      }
    }
    try { result.reconciliation = await this.integrations.auraApi?.instances?.reconcileActor?.(actor) ?? null; } catch (error) {
      result.warnings.push({ auraRef: null, message: error?.message ?? String(error) });
    }
    return result;
  }

  async cleanupAfflictions(actor) {
    const api = this.integrations?.afflictionApi;
    const result = { referencesRemoved: 0, templatesRemoved: 0 };
    if (!actor || !api) return result;
    if (api.references?.list && (api.references?.set || api.references?.remove)) {
      for (const item of itemsOf(actor)) {
        try {
          const refs = api.references.list(item) ?? [];
          const owned = refs.filter((reference) => reference?.metadata?.originModule === MODULE_ID);
          if (!owned.length) continue;
          if (api.references.set) {
            const kept = refs.filter((reference) => reference?.metadata?.originModule !== MODULE_ID);
            await api.references.set(item, kept);
            result.referencesRemoved += owned.length;
          } else {
            for (const reference of owned) {
              await api.references.remove(item, reference.id);
              result.referencesRemoved += 1;
            }
          }
        } catch (error) {
          console.warn(`${MODULE_ID} | Could not clean generated Affliction references from '${item?.name ?? item?.id ?? "item"}'.`, error);
        }
      }
    }
    const templateIds = itemsOf(actor)
      .filter((item) => cfFlags(item).runtimeAfflictionTemplate === true || (affFlags(item).documentKind === "affliction-template" && affFlags(item).originModule === MODULE_ID))
      .map((item) => item.id).filter(Boolean);
    if (templateIds.length && typeof actor.deleteEmbeddedDocuments === "function") {
      await actor.deleteEmbeddedDocuments("Item", templateIds, { render: false });
      result.templatesRemoved = templateIds.length;
    }
    return result;
  }

  async materializeAfflictions(actor, blueprint = actorBlueprint(actor)) {
    const api = this.integrations?.afflictionApi;
    const result = { available: this.afflictionMaterializationAvailable, templates: [], bindings: [], warnings: [], cleanup: null };
    if (!actor || !blueprint) return result;
    result.cleanup = await this.cleanupAfflictions(actor);
    if (!this.afflictionMaterializationAvailable) return result;

    for (const resource of blueprint.resources?.afflictions ?? []) {
      try {
        const definition = localizedAffliction(resource);
        const report = api.definitions?.validate?.(definition);
        if (!definitionValid(report)) throw new Error((report?.errors ?? []).map((entry) => entry?.message ?? String(entry)).join(" ") || "Invalid Affliction definition.");

        let templateUuid = canonicalTemplateUuid(resource);
        let template = null;
        let templateKind = "library";
        if (!templateUuid) {
          if (typeof actor.createEmbeddedDocuments !== "function") throw new Error("Actor-local Affliction templates require createEmbeddedDocuments().");
          const source = api.documents.buildTemplateSource(definition);
          source.flags ??= {};
          source.flags[MODULE_ID] = { runtimeAfflictionTemplate: true, runtimeAfflictionRef: resource.id, generated: true };
          if (source.system?.tokenIcon) source.system.tokenIcon.show = false;
          const created = await actor.createEmbeddedDocuments("Item", [source], { render: false });
          template = Array.isArray(created) ? created[0] : created;
          if (!template) throw new Error("Actor-local Affliction template could not be created.");
          templateUuid = template.uuid;
          templateKind = "actor";
        }
        result.templates.push({ afflictionRef: resource.id, itemId: template?.id ?? null, uuid: templateUuid, kind: templateKind, canonical: templateKind === "library" });

        const host = hostItemFor(actor, resource.delivery, blueprint);
        if (!host) {
          const intended = resource.delivery?.mode === "hosted";
          const binding = {
            afflictionRef: resource.id,
            mode: "manual",
            status: intended ? "host-missing" : "manual",
            templateUuid,
            delivery: resource.delivery ?? null
          };
          result.bindings.push(binding);
          if (intended) result.warnings.push({ afflictionRef: resource.id, code: "AFFLICTION_HOST_NOT_FOUND", message: `Could not resolve the generated ${resource.delivery?.hostType ?? "host"} '${resource.delivery?.hostId ?? ""}' for Affliction delivery.` });
          continue;
        }
        if (api.references?.isHostItem && !api.references.isHostItem(host)) {
          result.bindings.push({ afflictionRef: resource.id, mode: "manual", status: "host-ineligible", templateUuid, delivery: resource.delivery ?? null, intendedHostItemId: host.id });
          result.warnings.push({ afflictionRef: resource.id, code: "AFFLICTION_HOST_INELIGIBLE", message: `Resolved host '${host.name ?? host.id}' is not eligible for Affliction references.` });
          continue;
        }

        const label = localize(resource.nameKey, definition.name ?? resource.name ?? resource.id);
        const base = {
          id: `cf-${String(resource.id).replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-${host.id}`,
          templateUuid,
          label,
          trigger: resource.delivery?.trigger ?? "on-hit",
          application: resource.delivery?.application ?? "prompt",
          enabled: true,
          metadata: { originModule: MODULE_ID, afflictionRef: resource.id, actorUuid: actor.uuid, hostType: resource.delivery?.hostType, hostId: resource.delivery?.hostId }
        };
        const reference = resource.delivery?.injuryPoison && api.references?.createInjuryPoison
          ? api.references.createInjuryPoison({ ...base, charges: resource.delivery?.charges ?? 1 })
          : api.references.create(base);
        await api.references.add(host, reference);

        const persisted = persistedReference(api, actor, host, reference.id);
        if (!persisted) {
          result.bindings.push({
            afflictionRef: resource.id,
            mode: "manual",
            status: "reference-not-persisted",
            templateUuid,
            intendedHostItemId: host.id,
            intendedHostItemUuid: host.uuid,
            hostName: host.name,
            referenceId: reference.id,
            delivery: resource.delivery
          });
          result.warnings.push({ afflictionRef: resource.id, code: "AFFLICTION_REFERENCE_NOT_PERSISTED", message: `Affliction reference '${reference.id}' was written to '${host.name ?? host.id}' but could not be read back. Manual application remains available.` });
          continue;
        }

        result.bindings.push({
          afflictionRef: resource.id,
          mode: "hosted",
          status: "verified",
          verified: true,
          templateUuid,
          hostItemId: host.id,
          hostItemUuid: host.uuid,
          hostName: host.name,
          referenceId: persisted.id,
          reference: persisted,
          delivery: resource.delivery,
          templateKind
        });
      } catch (error) {
        result.warnings.push({ afflictionRef: resource.id, code: "AFFLICTION_BINDING_FAILED", message: error?.message ?? String(error) });
        result.bindings.push({ afflictionRef: resource.id, mode: "manual", status: "error", delivery: resource.delivery ?? null, error: error?.message ?? String(error) });
        console.warn(`${MODULE_ID} | Affliction materialization/binding failed for ${resource.id}.`, error);
      }
    }
    await this.updateAfflictionHostDescriptions(actor, blueprint, result.bindings);
    return result;
  }

  async updateAfflictionHostDescriptions(actor, blueprint, bindings = []) {
    if (!actor || !blueprint) return [];
    const resources = new Map((blueprint.resources?.afflictions ?? []).map((entry) => [entry.id, entry]));
    const byHost = new Map();
    for (const binding of bindings.filter((entry) => entry.mode === "hosted" && entry.hostItemId)) {
      if (!byHost.has(binding.hostItemId)) byHost.set(binding.hostItemId, []);
      byHost.get(binding.hostItemId).push({ binding, resource: resources.get(binding.afflictionRef) });
    }
    const updates = [];
    for (const item of itemsOf(actor)) {
      if (!cfFlags(item).attackId && !cfFlags(item).abilityId && !byHost.has(item.id)) continue;
      const linked = byHost.get(item.id) ?? [];
      const current = item.system?.description?.value ?? "";
      updates.push({ _id: item.id, "system.description.value": buildAfflictionHostDescription(current, linked) });
    }
    if (updates.length && typeof actor.updateEmbeddedDocuments === "function") return actor.updateEmbeddedDocuments("Item", updates, { render: false });
    return [];
  }

  async updateAfflictionDescriptions(actor, blueprint = actorBlueprint(actor), bindings = []) {
    if (!actor || !blueprint) return [];
    const resources = new Map((blueprint.resources?.afflictions ?? []).map((entry) => [entry.id, entry]));
    const bindingMap = new Map(bindings.map((entry) => [entry.afflictionRef, entry]));
    const updates = [];
    for (const item of itemsOf(actor)) {
      const ref = cfFlags(item).afflictionRef;
      const resource = ref ? resources.get(ref) : null;
      if (!resource) continue;
      updates.push({
        _id: item.id,
        "system.description.value": buildAfflictionDescription(resource, { actorUuid: actor.uuid, runtimeAvailable: this.afflictionAvailable, binding: bindingMap.get(ref) ?? null })
      });
    }
    if (!updates.length) return [];
    if (typeof actor.updateEmbeddedDocuments === "function") return actor.updateEmbeddedDocuments("Item", updates, { render: false });
    return [];
  }

  async applyAffliction({ actor, afflictionRef, targets = null } = {}) {
    if (!this.afflictionAvailable) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.AfflictionForgeUnavailable", "Affliction Forge integration is unavailable."));
    const blueprint = actorBlueprint(actor);
    const resource = blueprint?.resources?.afflictions?.find((entry) => entry.id === afflictionRef || entry.contentId === afflictionRef);
    if (!resource) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.AfflictionDefinitionMissing", "The linked affliction definition could not be found."));
    const resolvedTargets = targets ? (Array.isArray(targets) ? targets : [targets]) : selectedTargets();
    if (!resolvedTargets.length) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.NoTargets", "Select at least one target before applying this affliction."));
    const definition = localizedAffliction(resource);
    const templateUuid = canonicalTemplateUuid(resource);
    const options = {
      sourceActorUuid: actor?.uuid ?? null, sourceActor: actor,
      creatureForge: { actorUuid: actor?.uuid ?? null, afflictionRef: resource.id }
    };
    const result = templateUuid && typeof this.integrations.afflictionApi.engine?.applyTemplate === "function"
      ? await this.integrations.afflictionApi.engine.applyTemplate(templateUuid, resolvedTargets, options)
      : await this.integrations.afflictionApi.engine.applyDefinition(definition, resolvedTargets, options);
    return { result, actor, resource, targets: resolvedTargets };
  }

  async initializeActor(actor, blueprint = actorBlueprint(actor)) {
    const auras = await this.materializeAuras(actor, blueprint);
    const afflictions = await this.materializeAfflictions(actor, blueprint);
    const updatedAfflictions = await this.updateAfflictionDescriptions(actor, blueprint, afflictions.bindings);
    return { actor, auras, afflictions, updatedAfflictions, afflictionAvailable: this.afflictionAvailable };
  }
}

let uiInitialized = false;
export function initializeSpecialFeatureRuntimeUi(runtime) {
  if (uiInitialized) return;
  uiInitialized = true;
  globalThis.document?.addEventListener?.("click", async (event) => {
    const button = event.target?.closest?.(".pf2e-creature-forge-apply-affliction");
    if (!button) return;
    event.preventDefault(); event.stopPropagation();
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
    } finally { button.disabled = false; }
  }, true);
}
