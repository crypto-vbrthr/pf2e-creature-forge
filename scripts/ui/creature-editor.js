import { RANKS, SIZES, SKILL_SLUGS } from "../constants.js";
import { ROLE_IDS } from "../core/role-presets.js";
import { deepClone } from "../core/clone.js";
import { CreatureEditorSession } from "./editor-session.js";
import { resolveAttackNameKey } from "../core/attack-localization.js";

const ABILITIES = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);

function localize(key, fallback = key) {
  const value = globalThis.game?.i18n?.localize?.(key);
  return value && value !== key ? value : fallback;
}

function option(value, label, selected) {
  return `<option value="${value}"${String(selected) === String(value) ? " selected" : ""}>${label}</option>`;
}

function rankOptions(current, allowed, includeRole = true) {
  const result = [];
  if (includeRole) result.push(option("role", localize("PF2E_CREATURE_FORGE.Editor.RoleDefault", "Role default"), current));
  for (const rank of allowed) result.push(option(rank, localize(`PF2E_CREATURE_FORGE.Rank.${rank}`, rank), current));
  return result.join("");
}

function roleOptions(current) {
  return ROLE_IDS.map((role) => option(role, localize(`PF2E_CREATURE_FORGE.Role.${role}`, role), current)).join("");
}

function sizeOptions(current) {
  return SIZES.map((size) => option(size, localize(`PF2E_CREATURE_FORGE.Size.${size}`, size), current)).join("");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function signed(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n >= 0 ? `+${n}` : String(n);
}

function rankLabel(rank) {
  return localize(`PF2E_CREATURE_FORGE.Rank.${rank}`, rank ?? "");
}

function attackNameLabel(attack) {
  const nameKey = resolveAttackNameKey(attack);
  return nameKey ? localize(nameKey, attack?.name ?? "") : String(attack?.name ?? "");
}

function damageTypeLabel(type) {
  return localize(`PF2E_CREATURE_FORGE.DamageType.${type}`, type ?? "");
}

function skillLabel(slug) {
  return localize(`PF2E_CREATURE_FORGE.Skill.${slug}`, slug ?? "");
}

function movementLabel(type) {
  return localize(`PF2E_CREATURE_FORGE.Movement.${type}`, type ?? "");
}

function senseLabel(type) {
  return localize(`PF2E_CREATURE_FORGE.Sense.${type}`, type ?? "");
}

function abilityNameLabel(ability) {
  return localize(ability?.nameKey, ability?.name ?? ability?.contentId ?? "Ability");
}

function abilityDescriptionLabel(ability) {
  return localize(ability?.descriptionKey, ability?.description ?? "");
}

function abilityTypeLabel(ability) {
  const type = ability?.type ?? "action";
  if (type === "action") return `${Number(ability?.actionCost ?? 1)} ${localize("PF2E_CREATURE_FORGE.AbilityType.Actions", "actions")}`;
  return localize(`PF2E_CREATURE_FORGE.AbilityType.${type}`, type);
}

function affinityTypeLabel(type) {
  return localize(`PF2E_CREATURE_FORGE.AffinityType.${type}`, String(type ?? "").replaceAll("-", " "));
}

function affinitySourceLabel(entry) {
  const key = entry?.source?.labelKey;
  if (key) return localize(key, entry?.source?.contentId ?? "");
  if (entry?.source?.kind === "manual") return localize("PF2E_CREATURE_FORGE.AffinitySource.Manual", "Manual");
  return entry?.source?.moduleId ?? entry?.source?.kind ?? "";
}

function affinityRows(entries = [], { valued = false } = {}) {
  return entries.map((entry) => {
    const exceptions = entry.exceptions?.length
      ? ` · ${localize("PF2E_CREATURE_FORGE.Affinity.Except", "except")} ${entry.exceptions.map(affinityTypeLabel).join(", ")}`
      : "";
    const doubled = entry.doubleVs?.length
      ? ` · ${localize("PF2E_CREATURE_FORGE.Affinity.DoubleVs", "double vs.")} ${entry.doubleVs.map(affinityTypeLabel).join(", ")}`
      : "";
    const source = affinitySourceLabel(entry);
    return `<li class="cf-compact-row"><strong>${escapeHtml(affinityTypeLabel(entry.type))}${valued ? ` ${Number(entry.value ?? 0)}` : ""}</strong><span>${escapeHtml(`${exceptions}${doubled}`.replace(/^ · /, ""))}${source ? `<small>${escapeHtml(source)}</small>` : ""}</span></li>`;
  }).join("");
}

function speedOptions(current, { land = false } = {}) {
  const result = [];
  if (land) result.push(option("role", localize("PF2E_CREATURE_FORGE.Editor.RoleDefault", "Role default"), current));
  else {
    result.push(option("auto", localize("PF2E_CREATURE_FORGE.Field.Auto", "Automatic"), current));
    result.push(option("none", localize("PF2E_CREATURE_FORGE.Field.None", "None"), current));
  }
  for (const value of [10, 15, 20, 25, 30, 35, 40, 50, 60]) result.push(option(String(value), `${value} ft.`, current));
  return result.join("");
}

function triStateOptions(current) {
  return [
    option("auto", localize("PF2E_CREATURE_FORGE.Field.Auto", "Automatic"), current),
    option("on", localize("PF2E_CREATURE_FORGE.Field.Enabled", "Enabled"), current),
    option("off", localize("PF2E_CREATURE_FORGE.Field.Disabled", "Disabled"), current)
  ].join("");
}

export class EmbeddedCreatureEditor {
  static CONTRACT_VERSION = 7;

  constructor({ api, session = null, request = {}, blueprint = null, mode = "create", layout = "full", activeTab = "creature", capabilities = {}, onChange = null, onGenerate = null } = {}) {
    if (!api) throw new Error("EmbeddedCreatureEditor requires the Creature Forge API.");
    this.api = api;
    this.session = session ?? new CreatureEditorSession({ api, request, blueprint, mode });
    this.mode = mode;
    this.layout = layout;
    this.activeTab = activeTab === "sources" ? "sources" : "creature";
    this.tabScrollPositions = { creature: 0, sources: 0 };
    this.capabilities = {
      generation: true,
      actorCreation: false,
      sourceSelection: false,
      persistSourceSelection: false,
      advancedEditing: true,
      effectEditing: true,
      ...capabilities
    };
    this.onChange = onChange;
    this.onGenerate = onGenerate;
    this.container = null;
    this.root = null;
    this.scrollElement = null;
    this.boundHandler = null;
    this.effectEditor = null;
    this.activeEffectId = null;
  }

  get value() { return deepClone(this.session.blueprint); }
  get request() { return deepClone(this.session.request); }
  get isDirty() { return Boolean(this.session.dirty); }
  get element() { return this.root; }
  get currentTab() { return this.activeTab; }

  setActiveTab(tab) {
    const next = tab === "sources" && this.capabilities.sourceSelection ? "sources" : "creature";
    if (next === this.activeTab) return this;
    if (this.scrollElement) this.tabScrollPositions[this.activeTab] = this.scrollElement.scrollTop;
    this.activeEffectId = null;
    this.activeTab = next;
    this.#render({ captureScroll: false });
    return this;
  }

  async mount(container, options = {}) {
    if (!(container instanceof HTMLElement)) throw new TypeError("Creature editor host must be an HTMLElement.");
    this.unmount();
    this.container = container;
    this.container.classList.add("cf-editor-mount");
    if (options.layout) this.layout = options.layout;
    if (options.activeTab) this.activeTab = options.activeTab === "sources" && this.capabilities.sourceSelection ? "sources" : "creature";
    if (!this.capabilities.sourceSelection) this.activeTab = "creature";
    if (Number.isFinite(Number(options.minHeight))) {
      this.container.style.setProperty("--cf-editor-min-height", `${Math.max(320, Number(options.minHeight))}px`);
    }
    try {
      await this.api.sources.ensure(this.session.request.sources);
      this.#reconcileContentSelection();
    } catch (error) {
      console.warn("pf2e-creature-forge | Could not prepare compendium discovery sources.", error);
      globalThis.ui?.notifications?.warn?.(localize("PF2E_CREATURE_FORGE.Notifications.SourceScanFailed", "One or more creature compendiums could not be scanned."));
    }
    if (!this.session.blueprint) this.session.generate();
    this.#render();
    return this;
  }

  unmount({ clearContainer = true } = {}) {
    this.effectEditor?.unmount?.();
    this.effectEditor = null;
    if (this.root && this.boundHandler) {
      this.root.removeEventListener("change", this.boundHandler);
      this.root.removeEventListener("input", this.boundHandler);
      this.root.removeEventListener("click", this.boundHandler);
    }
    if (this.container) {
      this.container.classList.remove("cf-editor-mount");
      this.container.style.removeProperty("--cf-editor-min-height");
      if (clearContainer) this.container.replaceChildren();
    }
    this.root = null;
    this.scrollElement = null;
    this.boundHandler = null;
    this.container = null;
  }

  destroy() { this.unmount(); }

  async setValue(blueprint) {
    this.session.blueprint = deepClone(blueprint);
    this.session.request = this.api.createRequest(blueprint?.metadata?.requestSnapshot ?? this.session.request);
    this.session.dirty = true;
    await this.api.sources.ensure(this.session.request.sources);
    this.#reconcileContentSelection();
    this.#render();
    return this;
  }

  async setRequest(request) {
    this.session.setRequest(request);
    await this.api.sources.ensure(this.session.request.sources);
    this.#reconcileContentSelection();
    this.#render();
    return this;
  }

  async refreshSources({ force = false } = {}) {
    await this.api.sources.ensure(this.session.request.sources, { force });
    this.#reconcileContentSelection();
    this.#render();
    return this;
  }

  validate() { return this.session.validate(); }
  markClean() { this.session.markClean(); }

  async #emitChange(kind = "change") {
    await this.onChange?.({ kind, blueprint: this.value, request: this.request, validation: this.validate(), dirty: this.isDirty });
  }

  #syncRequestFromForm() {
    if (!this.container) return;
    const root = this.root ?? this.container;
    const request = this.api.createRequest(this.session.request);
    const get = (name) => root.querySelector(`[name="${name}"]`);
    request.identity.name = get("name")?.value ?? "";
    request.identity.level = number(get("level")?.value);
    request.identity.role = get("role")?.value ?? "custom";
    request.identity.category = get("category")?.value ?? "humanoid";
    request.identity.subtypes = [...(get("subtypes")?.selectedOptions ?? [])].map((entry) => entry.value).filter(Boolean);
    if (get("categorySources")) request.sources.categories = [...get("categorySources").selectedOptions].map((entry) => entry.value).filter(Boolean);
    if (get("subtypeSources")) request.sources.subtypes = [...get("subtypeSources").selectedOptions].map((entry) => entry.value).filter(Boolean);
    request.identity.size = get("size")?.value ?? "med";
    for (const ability of ABILITIES) request.attributes[ability] = get(ability)?.value ?? "role";
    request.defenses.ac = get("ac")?.value ?? "role";
    request.defenses.hp = get("hp")?.value ?? "role";
    request.defenses.perception = get("perception")?.value ?? "role";
    request.defenses.saves.fortitude = get("fortitude")?.value ?? "role";
    request.defenses.saves.reflex = get("reflex")?.value ?? "role";
    request.defenses.saves.will = get("will")?.value ?? "role";
    request.defensiveAffinities.mode = get("affinityMode")?.value ?? "auto";
    request.defensiveAffinities.hpCompensation = get("affinityHpCompensation")?.value ?? "auto";
    request.offense.attack = get("attackRank")?.value ?? "role";
    request.offense.damage = get("damageRank")?.value ?? "role";
    request.offense.kind = get("attackKind")?.value ?? "role";
    request.offense.damageType = get("damageType")?.value ?? "auto";
    request.options.attackCount = number(get("attackCount")?.value ?? 1);
    const skillCount = get("skillCount")?.value ?? "role";
    request.skills.count = skillCount === "role" ? "role" : number(skillCount);
    request.skills.primaryRank = get("primarySkillRank")?.value ?? "role";
    request.skills.preferred = String(get("preferredSkills")?.value ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
    const landSpeed = get("landSpeed")?.value ?? "role";
    request.movement.land = landSpeed === "role" ? "role" : number(landSpeed);
    for (const type of ["climb", "swim", "fly", "burrow"]) {
      const value = get(`${type}Speed`)?.value ?? "auto";
      request.movement[type] = ["auto", "none"].includes(value) ? value : number(value);
    }
    request.senses.lowLightVision = get("lowLightVision")?.value ?? "auto";
    request.senses.darkvision = get("darkvision")?.value ?? "auto";
    request.senses.scent = get("scent")?.value ?? "auto";
    request.senses.scentRange = number(get("scentRange")?.value ?? 30);
    request.abilities.mode = get("abilityMode")?.value ?? "auto";
    const abilityCount = get("abilityCount")?.value ?? "role";
    request.abilities.count = abilityCount === "role" ? "role" : number(abilityCount);
    request.abilities.complexity = get("abilityComplexity")?.value ?? "standard";
    request.abilities.focus = String(get("abilityFocus")?.value ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
    request.generation.seed = get("seed")?.value ?? "";
    request.generation.variation = get("variation")?.value ?? "balanced";
    this.session.setRequest(request);
  }

  #reconcileContentSelection() {
    const request = this.api.createRequest(this.session.request);
    const categories = this.api.sources.listContent("category", { selectedSources: request.sources.categories });
    const categorySlugs = new Set(categories.map((entry) => entry.slug ?? entry.id));
    if (!categorySlugs.has(request.identity.category)) {
      request.identity.category = categorySlugs.has("humanoid") ? "humanoid" : (categories[0]?.slug ?? categories[0]?.id ?? "humanoid");
    }
    const subtypeSlugs = new Set(this.api.sources.listContent("subtype", { selectedSources: request.sources.subtypes }).map((entry) => entry.slug ?? entry.id));
    request.identity.subtypes = (request.identity.subtypes ?? []).filter((slug) => subtypeSlugs.has(slug));
    this.session.setRequest(request);
  }

  async #handleEvent(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const requestedTab = target.closest?.("[data-cf-tab]")?.dataset?.cfTab;
    if (event.type === "click" && requestedTab) {
      event.preventDefault();
      this.setActiveTab(requestedTab);
      return;
    }

    const action = target.closest?.("[data-cf-action]")?.dataset?.cfAction;
    if (event.type === "click" && action) {
      event.preventDefault();
      if (action === "generate") {
        this.#syncRequestFromForm();
        this.session.generate();
        this.#render();
        await this.onGenerate?.({ blueprint: this.value, request: this.request });
        await this.#emitChange("generate");
      } else if (action === "reroll-all") {
        this.#syncRequestFromForm();
        this.session.generate();
        this.session.reroll({ scope: "all" });
        this.#render();
        await this.onGenerate?.({ blueprint: this.value, request: this.request });
        await this.#emitChange("reroll-all");
      } else if (action === "reroll-hp") {
        this.session.reroll({ scope: "statistics.hp" });
        this.#render();
        await this.#emitChange("reroll-hp");
      } else if (action === "reroll-skills") {
        this.session.reroll({ scope: "statistics.skills" });
        this.#render();
        await this.#emitChange("reroll-skills");
      } else if (action === "reroll-movement") {
        this.session.reroll({ scope: "statistics.movement" });
        this.#render();
        await this.#emitChange("reroll-movement");
      } else if (action === "reroll-senses") {
        this.session.reroll({ scope: "statistics.senses" });
        this.#render();
        await this.#emitChange("reroll-senses");
      } else if (action === "reroll-attacks") {
        this.session.reroll({ scope: "combat.attacks" });
        this.#render();
        await this.#emitChange("reroll-attacks");
      } else if (action === "reroll-affinities") {
        this.session.reroll({ scope: "defenses.affinities" });
        this.#render();
        await this.#emitChange("reroll-affinities");
      } else if (action === "reroll-abilities") {
        this.session.reroll({ scope: "abilities" });
        this.activeEffectId = null;
        this.#render();
        await this.#emitChange("reroll-abilities");
      } else if (action === "reroll-ability") {
        const abilityId = target.closest?.("[data-ability-id]")?.dataset?.abilityId;
        if (abilityId) {
          this.session.reroll({ scope: `ability:${abilityId}` });
          this.activeEffectId = null;
          this.#render();
          await this.#emitChange("reroll-ability");
        }
      } else if (action === "toggle-ability-lock") {
        const abilityId = target.closest?.("[data-ability-id]")?.dataset?.abilityId;
        const ability = this.session.blueprint?.abilities?.find((entry) => entry.id === abilityId);
        if (ability) {
          ability.locked = !ability.locked;
          this.session.dirty = true;
          this.#render();
          await this.#emitChange("ability-lock");
        }
      } else if (action === "edit-ability-effect" && this.capabilities.effectEditing) {
        const effectId = target.closest?.("[data-effect-id]")?.dataset?.effectId;
        if (effectId) {
          this.activeEffectId = effectId;
          this.#render();
        }
      } else if (action === "close-effect-editor") {
        this.activeEffectId = null;
        this.#render();
      } else if (action === "refresh-sources" && this.capabilities.sourceSelection) {
        this.#syncRequestFromForm();
        try {
          await this.api.sources.ensure(this.session.request.sources, { force: true });
          this.#reconcileContentSelection();
          if (this.capabilities.persistSourceSelection) await this.api.sources.setDefaults(this.session.request.sources);
          this.#render();
          await this.#emitChange("sources-refreshed");
        } catch (error) {
          console.error("pf2e-creature-forge | Source refresh failed.", error);
          globalThis.ui?.notifications?.error?.(localize("PF2E_CREATURE_FORGE.Notifications.SourceScanFailed", "One or more creature compendiums could not be scanned."));
        }
      } else if (action === "create-actor" && this.capabilities.actorCreation) {
        const { actor } = await this.api.createActor(this.session.blueprint, { renderSheet: true });
        globalThis.ui?.notifications?.info?.(localize("PF2E_CREATURE_FORGE.Notifications.ActorCreated", `Created ${actor?.name ?? "creature"}.`));
      }
      return;
    }

    if (event.type === "change" || (event.type === "input" && target.matches?.('input[name="name"], input[name="seed"], input[name="preferredSkills"], input[name="abilityFocus"]'))) {
      this.#syncRequestFromForm();
      if (event.type === "change" && target.matches?.('select[name="categorySources"], select[name="subtypeSources"]')) {
        try {
          await this.api.sources.ensure(this.session.request.sources);
          this.#reconcileContentSelection();
          if (this.capabilities.persistSourceSelection) await this.api.sources.setDefaults(this.session.request.sources);
          this.#render();
          await this.#emitChange("source-selection-change");
        } catch (error) {
          console.error("pf2e-creature-forge | Source selection failed.", error);
          globalThis.ui?.notifications?.error?.(localize("PF2E_CREATURE_FORGE.Notifications.SourceScanFailed", "One or more creature compendiums could not be scanned."));
        }
        return;
      }
      if (event.type === "change" && target.matches?.('select[name="category"]')) this.#render();
      await this.#emitChange("request-change");
    }
  }

  async #mountActiveEffectEditor() {
    this.effectEditor?.unmount?.();
    this.effectEditor = null;
    if (!this.activeEffectId || !this.root || !this.capabilities.effectEditing) return;
    const resource = this.session.blueprint?.resources?.effects?.find((entry) => entry.id === this.activeEffectId);
    const host = this.root.querySelector(`[data-cf-effect-editor-host="${globalThis.CSS?.escape ? globalThis.CSS.escape(this.activeEffectId) : this.activeEffectId.replaceAll('"', '\\"')}"]`);
    const effectApi = this.api.integrations.getEffectApi?.();
    if (!resource || !(host instanceof HTMLElement) || !effectApi?.ui?.effectEditor?.create) return;
    const definition = deepClone(resource.definition);
    if (resource.nameKey) definition.name = localize(resource.nameKey, definition.name ?? resource.name);
    this.effectEditor = effectApi.ui.effectEditor.create({
      definition,
      layout: "compact",
      onChange: (session) => {
        const updated = session.buildDefinition({ api: effectApi });
        resource.definition = deepClone(updated);
        resource.name = updated.name ?? resource.name;
        this.session.dirty = true;
        this.#emitChange("effect-change");
      }
    });
    try {
      await this.effectEditor.mount(host);
    } catch (error) {
      console.error("pf2e-creature-forge | Could not mount embedded Effect Editor.", error);
      host.innerHTML = `<p class="cf-muted">${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.EffectEditorUnavailable", "Effect Editor could not be opened."))}</p>`;
    }
  }

  #render({ captureScroll = true } = {}) {
    if (!this.container) return;
    if (!this.capabilities.sourceSelection) this.activeTab = "creature";
    // When an embedded Effect Editor is active the normal creature scroll area is
    // hidden. Browsers report that hidden element at scrollTop 0 in some layouts.
    // Never let that synthetic zero overwrite the position captured when effect
    // editing was opened, otherwise closing the Effect Editor jumps to the top.
    const previousRenderWasEffectMode = Boolean(this.root?.classList?.contains("cf-effect-mode"));
    if (captureScroll && this.scrollElement && !previousRenderWasEffectMode) {
      this.tabScrollPositions[this.activeTab] = this.scrollElement.scrollTop;
    }
    const previousScrollTop = this.tabScrollPositions[this.activeTab] ?? 0;
    if (this.boundHandler && this.root) {
      this.root.removeEventListener("change", this.boundHandler);
      this.root.removeEventListener("input", this.boundHandler);
      this.root.removeEventListener("click", this.boundHandler);
      this.boundHandler = null;
    }

    const request = this.session.request;
    const blueprint = this.session.blueprint;
    const validation = this.validate();
    const disabled = this.mode === "view" ? "disabled" : "";
    const compendiumSources = this.api.sources.listCompendiums({ documentName: "Actor" });
    const compendiumLabels = new Map(compendiumSources.map((entry) => [entry.id, entry.label]));
    const sourceOptions = (selected = []) => compendiumSources.map((entry) => {
      const suffix = entry.packageName ? ` · ${entry.packageName}` : "";
      return option(entry.id, escapeHtml(`${entry.label}${suffix}`), selected.includes(entry.id));
    }).join("");
    const categories = this.api.sources.listContent("category", { selectedSources: request.sources.categories }).map((entry) => ({
      value: entry.slug ?? entry.id,
      label: `${localize(entry.label, entry.slug ?? entry.id)}${entry.discoveredSources?.length ? ` · ${entry.discoveredSources.map((id) => compendiumLabels.get(id) ?? id).join(", ")}` : ""}`,
      discoveredSources: entry.discoveredSources ?? []
    }));
    const subtypeDefinitions = this.api.sources.listContent("subtype", { selectedSources: request.sources.subtypes })
      .map((entry) => ({
        value: entry.slug ?? entry.id,
        label: `${localize(entry.label, entry.slug ?? entry.id)}${entry.discoveredSources?.length ? ` · ${entry.discoveredSources.map((id) => compendiumLabels.get(id) ?? id).join(", ")}` : ""}`,
        supportedCategories: entry.supports?.categories ?? entry.selection?.categories ?? [],
        discoveredSources: entry.discoveredSources ?? []
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const selectedSubtypeSet = new Set(request.identity.subtypes ?? []);
    const subtypeOptions = subtypeDefinitions.map((entry) => {
      const incompatible = entry.supportedCategories.length && !entry.supportedCategories.includes(request.identity.category);
      return `<option value="${escapeHtml(entry.value)}"${selectedSubtypeSet.has(entry.value) ? " selected" : ""}${incompatible ? ' data-incompatible="true"' : ""}>${escapeHtml(entry.label)}${incompatible ? ` · ${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.OtherCategory", "other category"))}` : ""}</option>`;
    }).join("");
    const integrationStatus = this.api.integrations.getStatus();
    const statusRows = Object.entries(integrationStatus).map(([key, status]) => {
      const state = status.ready ? "ready" : status.active ? "partial" : "missing";
      return `<li class="cf-integration ${state}"><span>${escapeHtml(localize(`PF2E_CREATURE_FORGE.Integration.${key}`, key))}</span><strong>${escapeHtml(status.version || "—")}</strong></li>`;
    }).join("");
    const diagnostics = [...(validation.request.issues ?? []), ...(validation.blueprint.issues ?? [])];
    const diagnosticsHtml = diagnostics.length
      ? `<ul class="cf-diagnostics">${diagnostics.map((entry) => `<li class="${entry.level}">${escapeHtml(entry.message)}</li>`).join("")}</ul>`
      : `<p class="cf-ok">${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Valid", "Blueprint valid"))}</p>`;

    const abilityFields = ABILITIES.map((ability) => `
      <label><span>${escapeHtml(localize(`PF2E_CREATURE_FORGE.Field.${ability.toUpperCase()}`, ability.toUpperCase()))}</span>
        <select name="${ability}" ${disabled}>${rankOptions(request.attributes[ability], RANKS.ATTRIBUTE)}</select>
      </label>`).join("");

    const abilityPreview = ABILITIES.map((ability) => {
      const stat = blueprint?.statistics?.abilities?.[ability];
      return `<div><dt>${escapeHtml(localize(`PF2E_CREATURE_FORGE.Field.${ability.toUpperCase()}`, ability.toUpperCase()))}</dt><dd>${signed(stat?.value)} <small>${escapeHtml(rankLabel(stat?.rank))}</small></dd></div>`;
    }).join("");

    const skillRows = Object.values(blueprint?.statistics?.skills ?? {}).map((skill) => `
      <li class="cf-compact-row"><strong>${escapeHtml(skillLabel(skill.slug))}</strong><span>${signed(skill.value)} <small>${escapeHtml(rankLabel(skill.rank))}</small></span></li>`).join("");
    const movementRows = [
      { type: "land", value: blueprint?.statistics?.speed?.land },
      ...(blueprint?.statistics?.speed?.other ?? [])
    ].filter((entry) => Number(entry?.value) > 0).map((entry) => `
      <li class="cf-compact-row"><strong>${escapeHtml(movementLabel(entry.type))}</strong><span>${Number(entry.value)} ft.</span></li>`).join("");
    const senseRows = (blueprint?.statistics?.senses ?? []).map((sense) => `
      <li class="cf-compact-row"><strong>${escapeHtml(senseLabel(sense.type))}</strong><span>${sense.range ? `${Number(sense.range)} ft. · ` : ""}${escapeHtml(localize(`PF2E_CREATURE_FORGE.Acuity.${sense.acuity}`, sense.acuity ?? ""))}</span></li>`).join("");

    const attackRows = (blueprint?.combat?.attacks ?? []).map((attack) => `
      <li class="cf-attack-row">
        <div><strong>${escapeHtml(attackNameLabel(attack))}</strong><small>${escapeHtml(localize(`PF2E_CREATURE_FORGE.AttackProfile.${attack.profile}`, attack.profile))} · ${escapeHtml(localize(`PF2E_CREATURE_FORGE.AttackKind.${attack.kind}`, attack.kind))}</small></div>
        <div class="cf-attack-numbers"><span>${signed(attack.attack.value)} <small>${escapeHtml(rankLabel(attack.attack.rank))}</small></span><span>${escapeHtml(attack.damage.formula)} ${escapeHtml(damageTypeLabel(attack.damage.type))} <small>${escapeHtml(rankLabel(attack.damage.rank))}</small></span></div>
      </li>`).join("");

    const effectResources = new Map((blueprint?.resources?.effects ?? []).map((resource) => [resource.id, resource]));
    const effectIntegrationReady = Boolean(integrationStatus?.effect?.ready && this.api.integrations.getEffectApi?.()?.ui?.effectEditor?.create);
    const abilityRows = (blueprint?.abilities ?? []).map((ability) => {
      const linkedEffects = (ability.applications ?? [])
        .filter((application) => application.type === "effect" && application.ref)
        .map((application) => ({ application, resource: effectResources.get(application.ref) }))
        .filter(({ resource }) => resource);
      const effectButtons = linkedEffects.map(({ application, resource }) => {
        const label = localize(resource.nameKey, resource.definition?.name ?? resource.name ?? resource.id);
        return `<button type="button" class="cf-effect-link" data-cf-action="edit-ability-effect" data-effect-id="${escapeHtml(resource.id)}" ${!effectIntegrationReady || !this.capabilities.effectEditing ? "disabled" : ""}><i class="fa-solid fa-wand-magic-sparkles"></i> ${escapeHtml(label)} <small>${escapeHtml(application.timing ?? "")}</small></button>`;
      }).join("");
      const source = ability.source?.moduleId ? `<small class="cf-ability-source">${escapeHtml(ability.source.moduleId)}</small>` : "";
      return `<article class="cf-ability-card${ability.locked ? " locked" : ""}" data-ability-id="${escapeHtml(ability.id)}">
        <header><div><strong>${escapeHtml(abilityNameLabel(ability))}</strong><small>${escapeHtml(abilityTypeLabel(ability))} · ${escapeHtml(localize(`PF2E_CREATURE_FORGE.AbilityCategory.${ability.category}`, ability.category ?? ""))}</small>${source}</div>
        <div class="cf-ability-controls">
          ${this.capabilities.generation && this.mode !== "view" ? `<button type="button" class="cf-icon-button" data-cf-action="toggle-ability-lock" title="${escapeHtml(localize(ability.locked ? "PF2E_CREATURE_FORGE.Action.Unlock" : "PF2E_CREATURE_FORGE.Action.Lock", ability.locked ? "Unlock" : "Lock"))}"><i class="fa-solid ${ability.locked ? "fa-lock" : "fa-lock-open"}"></i></button>` : ""}
          ${this.capabilities.generation && this.mode !== "view" && !ability.locked ? `<button type="button" class="cf-icon-button" data-cf-action="reroll-ability" title="${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.RerollAbility", "Reroll ability"))}"><i class="fa-solid fa-dice"></i></button>` : ""}
        </div></header>
        <p>${escapeHtml(abilityDescriptionLabel(ability))}</p>
        ${ability.traits?.length ? `<div class="cf-ability-tags">${ability.traits.map((trait) => `<span>${escapeHtml(trait)}</span>`).join("")}</div>` : ""}
        ${effectButtons ? `<div class="cf-ability-effects">${effectButtons}</div>` : ""}
      </article>`;
    }).join("");
    const activeEffectResource = this.activeEffectId ? effectResources.get(this.activeEffectId) : null;
    const effectWorkspace = activeEffectResource ? `<section class="cf-effect-workspace" role="dialog" aria-modal="true" aria-label="${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.EffectEditor", "Effect Editor"))}">
      <header class="cf-effect-workspace-header">
        <div class="cf-effect-workspace-title">
          <span class="cf-effect-workspace-kicker"><i class="fa-solid fa-wand-magic-sparkles"></i> ${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.AbilityEffect", "Ability effect"))}</span>
          <h3>${escapeHtml(localize(activeEffectResource.nameKey, activeEffectResource.definition?.name ?? activeEffectResource.name ?? activeEffectResource.id))}</h3>
          <p>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.EffectEditorLiveHint", "Changes are applied directly to the creature blueprint."))}</p>
        </div>
        <button type="button" class="cf-effect-close" data-cf-action="close-effect-editor" title="${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.CloseEffectEditor", "Close effect editor"))}"><i class="fa-solid fa-xmark"></i><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.BackToCreature", "Back to creature"))}</span></button>
      </header>
      <div class="cf-effect-workspace-body">
        <div class="cf-effect-editor-host cf-effect-editor-compact" data-cf-effect-editor-host="${escapeHtml(activeEffectResource.id)}"></div>
      </div>
    </section>` : "";

    const immunityRows = affinityRows(blueprint?.defenses?.immunities ?? []);
    const resistanceRows = affinityRows(blueprint?.defenses?.resistances ?? [], { valued: true });
    const weaknessRows = affinityRows(blueprint?.defenses?.weaknesses ?? [], { valued: true });
    const hpAdjustment = Number(blueprint?.defenses?.hpAdjustment?.value ?? 0);

    this.effectEditor?.unmount?.();
    this.effectEditor = null;

    const canGenerate = this.capabilities.generation && this.mode !== "view";
    const canCreateActor = this.capabilities.actorCreation && this.mode !== "view";
    const validationState = validation.request.valid && validation.blueprint.valid ? "valid" : "invalid";

    this.container.innerHTML = `
      <section class="cf-editor cf-layout-${escapeHtml(this.layout)}${activeEffectResource ? " cf-effect-mode" : ""}" data-cf-editor data-cf-editor-contract="${EmbeddedCreatureEditor.CONTRACT_VERSION}">
        ${this.capabilities.sourceSelection ? `
          <nav class="cf-editor-tabs" role="tablist" aria-label="${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Tabs", "Creature Forge sections"))}">
            <button type="button" role="tab" data-cf-tab="creature" aria-selected="${this.activeTab === "creature"}" class="${this.activeTab === "creature" ? "active" : ""}"><i class="fa-solid fa-dragon"></i> ${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Tab.Creature", "Creature"))}</button>
            <button type="button" role="tab" data-cf-tab="sources" aria-selected="${this.activeTab === "sources"}" class="${this.activeTab === "sources" ? "active" : ""}"><i class="fa-solid fa-book-open"></i> ${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Tab.Sources", "Sources"))}</button>
          </nav>` : ""}
        <div class="cf-editor-scroll" data-cf-editor-scroll>
          <div class="cf-tab-panel ${this.activeTab === "creature" ? "active" : ""}" data-cf-tab-panel="creature" role="tabpanel">
            <div class="cf-grid">
          <section class="cf-panel cf-inputs">
            <h3>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Concept", "Concept"))}</h3>
            <div class="cf-form-grid">
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Name", "Name"))}</span><input name="name" type="text" value="${escapeHtml(request.identity.name)}" ${disabled}></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Level", "Level"))}</span><input name="level" type="number" min="-1" max="24" step="1" value="${request.identity.level}" ${disabled}></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Role", "Role"))}</span><select name="role" ${disabled}>${roleOptions(request.identity.role)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Category", "Category"))}</span><select name="category" ${disabled}>${categories.map((entry) => option(entry.value, entry.label, request.identity.category)).join("")}</select></label>
              <label class="cf-wide"><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Subtypes", "Subtypes"))}</span><select name="subtypes" multiple size="7" ${disabled}>${subtypeOptions}</select><small>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.SubtypeHint", "Select one or more subtypes. Category-specific entries are marked."))}</small></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Size", "Size"))}</span><select name="size" ${disabled}>${sizeOptions(request.identity.size)}</select></label>
            </div>

            <h3>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Attributes", "Attributes"))}</h3>
            <div class="cf-form-grid">${abilityFields}</div>

            <h3>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Defenses", "Defenses"))}</h3>
            <div class="cf-form-grid">
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.AC", "AC"))}</span><select name="ac" ${disabled}>${rankOptions(request.defenses.ac, RANKS.DEFENSE)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.HP", "HP"))}</span><select name="hp" ${disabled}>${rankOptions(request.defenses.hp, RANKS.HP)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Perception", "Perception"))}</span><select name="perception" ${disabled}>${rankOptions(request.defenses.perception, RANKS.SAVE)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Fortitude", "Fortitude"))}</span><select name="fortitude" ${disabled}>${rankOptions(request.defenses.saves.fortitude, RANKS.SAVE)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Reflex", "Reflex"))}</span><select name="reflex" ${disabled}>${rankOptions(request.defenses.saves.reflex, RANKS.SAVE)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Will", "Will"))}</span><select name="will" ${disabled}>${rankOptions(request.defenses.saves.will, RANKS.SAVE)}</select></label>
            </div>
            <div class="cf-form-grid cf-affinity-settings">
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.DefensiveAffinities", "Defensive affinities"))}</span><select name="affinityMode" ${disabled}>${["auto","off"].map((value) => option(value, localize(`PF2E_CREATURE_FORGE.AffinityMode.${value}`, value), request.defensiveAffinities.mode)).join("")}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.AffinityHpCompensation", "HP compensation"))}</span><select name="affinityHpCompensation" ${disabled}>${["auto","off"].map((value) => option(value, localize(`PF2E_CREATURE_FORGE.AffinityHpCompensation.${value}`, value), request.defensiveAffinities.hpCompensation)).join("")}</select></label>
            </div>

            <h3>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Skills", "Skills"))}</h3>
            <div class="cf-form-grid">
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.SkillCount", "Skill count"))}</span><select name="skillCount" ${disabled}>${["role",0,1,2,3,4,5,6,7,8].map((value) => option(String(value), value === "role" ? localize("PF2E_CREATURE_FORGE.Editor.RoleDefault", "Role default") : String(value), String(request.skills.count))).join("")}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.PrimarySkillRank", "Best skill"))}</span><select name="primarySkillRank" ${disabled}>${rankOptions(request.skills.primaryRank, RANKS.SKILL)}</select></label>
              <label class="cf-wide"><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.PreferredSkills", "Preferred skills"))}</span><input name="preferredSkills" type="text" value="${escapeHtml((request.skills.preferred ?? []).join(", "))}" placeholder="athletics, stealth" ${disabled}></label>
            </div>

            <h3>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.MovementSenses", "Movement & Senses"))}</h3>
            <div class="cf-form-grid">
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Movement.land", "Land Speed"))}</span><select name="landSpeed" ${disabled}>${speedOptions(request.movement.land, { land: true })}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Movement.climb", "Climb"))}</span><select name="climbSpeed" ${disabled}>${speedOptions(request.movement.climb)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Movement.swim", "Swim"))}</span><select name="swimSpeed" ${disabled}>${speedOptions(request.movement.swim)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Movement.fly", "Fly"))}</span><select name="flySpeed" ${disabled}>${speedOptions(request.movement.fly)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Movement.burrow", "Burrow"))}</span><select name="burrowSpeed" ${disabled}>${speedOptions(request.movement.burrow)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Sense.low-light-vision", "Low-light vision"))}</span><select name="lowLightVision" ${disabled}>${triStateOptions(request.senses.lowLightVision)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Sense.darkvision", "Darkvision"))}</span><select name="darkvision" ${disabled}>${triStateOptions(request.senses.darkvision)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Sense.scent", "Scent"))}</span><select name="scent" ${disabled}>${triStateOptions(request.senses.scent)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.ScentRange", "Scent range"))}</span><input name="scentRange" type="number" min="5" max="300" step="5" value="${Number(request.senses.scentRange ?? 30)}" ${disabled}></label>
            </div>

            <h3>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Offense", "Offense"))}</h3>
            <div class="cf-form-grid">
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.AttackCount", "Attacks"))}</span><select name="attackCount" ${disabled}>${[0,1,2].map((value) => option(String(value), String(value), String(request.options.attackCount))).join("")}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.AttackKind", "Attack type"))}</span><select name="attackKind" ${disabled}>${["role","melee","ranged"].map((value) => option(value, localize(value === "role" ? "PF2E_CREATURE_FORGE.Editor.RoleDefault" : `PF2E_CREATURE_FORGE.AttackKind.${value}`, value), request.offense.kind)).join("")}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.AttackRank", "Attack bonus"))}</span><select name="attackRank" ${disabled}>${rankOptions(request.offense.attack, RANKS.ATTACK)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.DamageRank", "Damage"))}</span><select name="damageRank" ${disabled}>${rankOptions(request.offense.damage, RANKS.DAMAGE)}</select></label>
              <label class="cf-wide"><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.DamageType", "Damage type"))}</span><select name="damageType" ${disabled}>${["auto","bludgeoning","piercing","slashing","acid","cold","electricity","fire","force","mental","poison","sonic","spirit","void","vitality"].map((value) => option(value, localize(value === "auto" ? "PF2E_CREATURE_FORGE.Field.Auto" : `PF2E_CREATURE_FORGE.DamageType.${value}`, value), request.offense.damageType)).join("")}</select></label>
            </div>

            <h3>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Abilities", "Abilities"))}</h3>
            <div class="cf-form-grid">
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.AbilityMode", "Ability generation"))}</span><select name="abilityMode" ${disabled}>${["auto","off"].map((value) => option(value, localize(`PF2E_CREATURE_FORGE.AbilityMode.${value}`, value), request.abilities.mode)).join("")}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.AbilityCount", "Ability count"))}</span><select name="abilityCount" ${disabled}>${["role",0,1,2,3,4,5].map((value) => option(String(value), value === "role" ? localize("PF2E_CREATURE_FORGE.Editor.RoleDefault", "Role default") : String(value), String(request.abilities.count))).join("")}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.AbilityComplexity", "Complexity"))}</span><select name="abilityComplexity" ${disabled}>${["simple","standard","complex"].map((value) => option(value, localize(`PF2E_CREATURE_FORGE.AbilityComplexity.${value}`, value), request.abilities.complexity)).join("")}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.AbilityFocus", "Focus tags"))}</span><input name="abilityFocus" type="text" value="${escapeHtml((request.abilities.focus ?? []).join(", "))}" placeholder="control, movement" ${disabled}></label>
            </div>

            <h3>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Generation", "Generation"))}</h3>
            <div class="cf-form-grid">
              <label class="cf-wide"><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Seed", "Seed"))}</span><input name="seed" type="text" value="${escapeHtml(request.generation.seed)}" placeholder="${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.AutoSeed", "automatic"))}" ${disabled}></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Variation", "Variation"))}</span><select name="variation" ${disabled}>${["conservative","balanced","experimental"].map((value) => option(value, localize(`PF2E_CREATURE_FORGE.Variation.${value}`, value), request.generation.variation)).join("")}</select></label>
            </div>

          </section>

          <section class="cf-panel cf-preview">
            <div class="cf-preview-header"><div><h3>${escapeHtml(blueprint?.identity?.name || localize("PF2E_CREATURE_FORGE.Untitled", "Creature"))}</h3><p>${escapeHtml(localize(`PF2E_CREATURE_FORGE.Role.${blueprint?.identity?.role}`, blueprint?.identity?.role ?? "custom"))} · ${escapeHtml(localize(`PF2E_CREATURE_FORGE.Size.${blueprint?.identity?.size}`, blueprint?.identity?.size ?? "med"))} · ${escapeHtml(blueprint?.identity?.traits?.join(", ") ?? "")}</p></div><span class="cf-level">${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Level", "Level"))} ${blueprint?.identity?.level ?? "—"}</span></div>

            <h4>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Attributes", "Attributes"))}</h4>
            <dl class="cf-stat-grid cf-ability-grid">${abilityPreview}</dl>

            <h4>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Defenses", "Defenses"))}</h4>
            <dl class="cf-stat-grid">
              <div><dt>RK / AC</dt><dd>${blueprint?.statistics?.ac?.value ?? "—"} <small>${escapeHtml(rankLabel(blueprint?.statistics?.ac?.rank))}</small></dd></div>
              <div><dt>TP / HP</dt><dd>${blueprint?.statistics?.hp?.value ?? "—"} <small>${escapeHtml(rankLabel(blueprint?.statistics?.hp?.rank))}${hpAdjustment ? ` · ${escapeHtml(localize("PF2E_CREATURE_FORGE.Affinity.HpAdjustment", "affinity"))} ${hpAdjustment > 0 ? "+" : ""}${hpAdjustment}` : ""}</small> ${this.capabilities.generation && this.mode !== "view" ? `<button type="button" class="cf-icon-button" title="Reroll HP" data-cf-action="reroll-hp"><i class="fa-solid fa-dice"></i></button>` : ""}</dd></div>
              <div><dt>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Perception", "Perception"))}</dt><dd>${signed(blueprint?.statistics?.perception?.value)}</dd></div>
              <div><dt>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Fortitude", "Fortitude"))}</dt><dd>${signed(blueprint?.statistics?.saves?.fortitude?.value)}</dd></div>
              <div><dt>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Reflex", "Reflex"))}</dt><dd>${signed(blueprint?.statistics?.saves?.reflex?.value)}</dd></div>
              <div><dt>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Will", "Will"))}</dt><dd>${signed(blueprint?.statistics?.saves?.will?.value)}</dd></div>
            </dl>

            <div class="cf-heading-row"><h4>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.DefensiveAffinities", "Immunities, Resistances & Weaknesses"))}</h4>${this.capabilities.generation && this.mode !== "view" ? `<button type="button" class="cf-icon-button" title="${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.RerollAffinities", "Reroll defensive affinities"))}" data-cf-action="reroll-affinities"><i class="fa-solid fa-dice"></i></button>` : ""}</div>
            <div class="cf-affinity-preview">
              <div><strong>${escapeHtml(localize("PF2E_CREATURE_FORGE.Affinity.Immunities", "Immunities"))}</strong>${immunityRows ? `<ul class="cf-compact-list">${immunityRows}</ul>` : `<p class="cf-muted">—</p>`}</div>
              <div><strong>${escapeHtml(localize("PF2E_CREATURE_FORGE.Affinity.Resistances", "Resistances"))}</strong>${resistanceRows ? `<ul class="cf-compact-list">${resistanceRows}</ul>` : `<p class="cf-muted">—</p>`}</div>
              <div><strong>${escapeHtml(localize("PF2E_CREATURE_FORGE.Affinity.Weaknesses", "Weaknesses"))}</strong>${weaknessRows ? `<ul class="cf-compact-list">${weaknessRows}</ul>` : `<p class="cf-muted">—</p>`}</div>
            </div>

            <div class="cf-heading-row"><h4>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Skills", "Skills"))}</h4>${this.capabilities.generation && this.mode !== "view" ? `<button type="button" class="cf-icon-button" title="${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.RerollSkills", "Reroll skills"))}" data-cf-action="reroll-skills"><i class="fa-solid fa-dice"></i></button>` : ""}</div>
            ${skillRows ? `<ul class="cf-compact-list">${skillRows}</ul>` : `<p class="cf-muted">${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.NoSkills", "No skills generated."))}</p>`}

            <div class="cf-heading-row"><h4>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Movement", "Movement"))}</h4>${this.capabilities.generation && this.mode !== "view" ? `<button type="button" class="cf-icon-button" title="${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.RerollMovement", "Reroll movement"))}" data-cf-action="reroll-movement"><i class="fa-solid fa-dice"></i></button>` : ""}</div>
            <ul class="cf-compact-list">${movementRows}</ul>

            <div class="cf-heading-row"><h4>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Senses", "Senses"))}</h4>${this.capabilities.generation && this.mode !== "view" ? `<button type="button" class="cf-icon-button" title="${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.RerollSenses", "Reroll senses"))}" data-cf-action="reroll-senses"><i class="fa-solid fa-dice"></i></button>` : ""}</div>
            ${senseRows ? `<ul class="cf-compact-list">${senseRows}</ul>` : `<p class="cf-muted">${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.NoSpecialSenses", "No special senses."))}</p>`}

            <div class="cf-heading-row"><h4>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Attacks", "Attacks"))}</h4>${this.capabilities.generation && this.mode !== "view" && (blueprint?.combat?.attacks?.length ?? 0) ? `<button type="button" class="cf-icon-button" title="${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.RerollAttacks", "Reroll attacks"))}" data-cf-action="reroll-attacks"><i class="fa-solid fa-dice"></i></button>` : ""}</div>
            ${(blueprint?.combat?.attacks?.length ?? 0) ? `<ul class="cf-attacks">${attackRows}</ul>` : `<p class="cf-muted">${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.NoAttacks", "No strikes generated."))}</p>`}

            <div class="cf-heading-row"><h4>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Abilities", "Abilities"))}</h4>${canGenerate && (blueprint?.abilities?.length ?? 0) ? `<button type="button" class="cf-icon-button" title="${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.RerollAbilities", "Reroll abilities"))}" data-cf-action="reroll-abilities"><i class="fa-solid fa-dice"></i></button>` : ""}</div>
            ${(blueprint?.abilities?.length ?? 0) ? `<div class="cf-abilities">${abilityRows}</div>` : `<p class="cf-muted">${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.NoAbilities", "No abilities generated."))}</p>`}

            <div class="cf-seed"><strong>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Seed", "Seed"))}:</strong> <code>${escapeHtml(blueprint?.metadata?.seed ?? "—")}</code></div>

            <h4>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.PlannedComponents", "Planned components"))}</h4>
            <div class="cf-component-grid">
              <span>${blueprint?.combat?.attacks?.length ?? 0} ${escapeHtml(localize("PF2E_CREATURE_FORGE.Component.Attacks", "attacks"))}</span>
              <span>${blueprint?.abilities?.length ?? 0} ${escapeHtml(localize("PF2E_CREATURE_FORGE.Component.Abilities", "abilities"))}</span>
              <span>${blueprint?.resources?.auras?.length ?? 0} ${escapeHtml(localize("PF2E_CREATURE_FORGE.Component.Auras", "auras"))}</span>
              <span>${blueprint?.resources?.afflictions?.length ?? 0} ${escapeHtml(localize("PF2E_CREATURE_FORGE.Component.Afflictions", "afflictions"))}</span>
            </div>

            <h4>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Integrations", "Forge integrations"))}</h4>
            <ul class="cf-integrations">${statusRows}</ul>
            <h4>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Validation", "Validation"))}</h4>
            ${diagnosticsHtml}
          </section>
            </div>
          </div>
          ${this.capabilities.sourceSelection ? `
            <div class="cf-tab-panel ${this.activeTab === "sources" ? "active" : ""}" data-cf-tab-panel="sources" role="tabpanel">
              <section class="cf-panel cf-sources-panel">
                <div class="cf-tab-heading">
                  <div>
                    <h3>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Sources", "Compendium sources"))}</h3>
                    <p>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.SourcesHint", "Choose which NPC compendiums may contribute discovered categories and subtypes. Creature Forge Core and registered extension content remain available."))}</p>
                  </div>
                  <span class="cf-source-scope">${escapeHtml(localize(this.capabilities.persistSourceSelection ? "PF2E_CREATURE_FORGE.Editor.SourceSelectionScope.World" : "PF2E_CREATURE_FORGE.Editor.SourceSelectionScope.Host", this.capabilities.persistSourceSelection ? "Saved as world defaults." : "Used only by this editor/request."))}</span>
                </div>
                <div class="cf-form-grid cf-source-grid">
                  <label class="cf-wide"><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.CategorySources", "Category compendiums"))}</span><select name="categorySources" multiple size="9" ${disabled}>${sourceOptions(request.sources.categories)}</select><small>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.CategorySourceHint", "Selected NPC compendiums can contribute additional creature categories."))}</small></label>
                  <label class="cf-wide"><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.SubtypeSources", "Subtype compendiums"))}</span><select name="subtypeSources" multiple size="9" ${disabled}>${sourceOptions(request.sources.subtypes)}</select><small>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.SubtypeSourceHint", "Traits observed on NPCs in the selected compendiums become additional subtype candidates."))}</small></label>
                </div>
                <div class="cf-source-actions">
                  <button type="button" data-cf-action="refresh-sources" ${disabled}><i class="fa-solid fa-arrows-rotate"></i> ${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.RefreshSources", "Rescan sources"))}</button>
                  <span class="cf-muted">${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.CoreAndExtensionsHint", "Core categories/subtypes and API-registered extension content are always available in addition to these compendium sources."))}</span>
                </div>
              </section>
            </div>` : ""}
        </div>
        ${effectWorkspace}
        ${(canGenerate || canCreateActor) ? `
          <footer class="cf-editor-footer" data-cf-editor-footer>
            <div class="cf-footer-state ${validationState}">
              <i class="fa-solid ${validationState === "valid" ? "fa-circle-check" : "fa-triangle-exclamation"}"></i>
              <span>${escapeHtml(validationState === "valid"
                ? localize("PF2E_CREATURE_FORGE.Editor.Valid", "Blueprint valid")
                : localize("PF2E_CREATURE_FORGE.Editor.Invalid", "Check validation warnings"))}</span>
            </div>
            <div class="cf-actions cf-footer-actions">
              ${canGenerate ? `<button type="button" data-cf-action="generate"><i class="fa-solid fa-hammer"></i> ${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.Generate", "Generate"))}</button>` : ""}
              ${canGenerate ? `<button type="button" data-cf-action="reroll-all"><i class="fa-solid fa-dice"></i> ${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.Reroll", "Reroll"))}</button>` : ""}
              ${canCreateActor ? `<button type="button" class="cf-primary-action" data-cf-action="create-actor"><i class="fa-solid fa-user-plus"></i> ${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.CreateActor", "Create actor"))}</button>` : ""}
            </div>
          </footer>` : ""}
      </section>`;

    this.root = this.container.querySelector("[data-cf-editor]");
    this.scrollElement = this.root?.querySelector("[data-cf-editor-scroll]") ?? null;
    if (this.scrollElement) this.scrollElement.scrollTop = previousScrollTop;
    this.boundHandler = this.#handleEvent.bind(this);
    this.root?.addEventListener("change", this.boundHandler);
    this.root?.addEventListener("input", this.boundHandler);
    this.root?.addEventListener("click", this.boundHandler);
    if (this.activeEffectId) queueMicrotask(() => this.#mountActiveEffectEditor());
  }
}

export function createCreatureEditorUiApi({ apiProvider }) {
  return {
    contractVersion: EmbeddedCreatureEditor.CONTRACT_VERSION,
    modes: Object.freeze(["create", "edit", "view"]),
    layouts: Object.freeze(["full", "compact"]),
    tabs: Object.freeze(["creature", "sources"]),
    createSession: (options = {}) => new CreatureEditorSession({ api: apiProvider(), ...options }),
    create: (options = {}) => new EmbeddedCreatureEditor({ api: apiProvider(), ...options })
  };
}
