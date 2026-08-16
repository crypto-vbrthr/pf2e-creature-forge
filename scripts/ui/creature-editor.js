import { MODULE_ID, RANKS, SIZES } from "../constants.js";
import { ROLE_IDS } from "../core/role-presets.js";
import { deepClone } from "../core/clone.js";
import { CreatureEditorSession } from "./editor-session.js";

function localize(key, fallback = key) {
  const value = globalThis.game?.i18n?.localize?.(key);
  return value && value !== key ? value : fallback;
}

function option(value, label, selected) {
  return `<option value="${value}"${selected === value ? " selected" : ""}>${label}</option>`;
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

export class EmbeddedCreatureEditor {
  static CONTRACT_VERSION = 1;

  constructor({ api, session = null, request = {}, blueprint = null, mode = "create", layout = "full", capabilities = {}, onChange = null, onGenerate = null } = {}) {
    if (!api) throw new Error("EmbeddedCreatureEditor requires the Creature Forge API.");
    this.api = api;
    this.session = session ?? new CreatureEditorSession({ api, request, blueprint, mode });
    this.mode = mode;
    this.layout = layout;
    this.capabilities = {
      generation: true,
      actorCreation: false,
      sourceSelection: false,
      advancedEditing: true,
      ...capabilities
    };
    this.onChange = onChange;
    this.onGenerate = onGenerate;
    this.container = null;
    this.boundHandler = null;
  }

  get value() { return deepClone(this.session.blueprint); }
  get request() { return deepClone(this.session.request); }
  get isDirty() { return Boolean(this.session.dirty); }

  async mount(container, options = {}) {
    if (!(container instanceof HTMLElement)) throw new TypeError("Creature editor host must be an HTMLElement.");
    this.unmount();
    this.container = container;
    if (options.layout) this.layout = options.layout;
    if (!this.session.blueprint) this.session.generate();
    this.#render();
    return this;
  }

  unmount({ clearContainer = true } = {}) {
    if (this.container && this.boundHandler) {
      this.container.removeEventListener("change", this.boundHandler);
      this.container.removeEventListener("input", this.boundHandler);
      this.container.removeEventListener("click", this.boundHandler);
    }
    if (clearContainer && this.container) this.container.replaceChildren();
    this.boundHandler = null;
    this.container = null;
  }

  destroy() {
    this.unmount();
  }

  setValue(blueprint) {
    this.session.blueprint = deepClone(blueprint);
    this.session.request = this.api.createRequest(blueprint?.metadata?.requestSnapshot ?? this.session.request);
    this.session.dirty = true;
    this.#render();
  }

  setRequest(request) {
    this.session.setRequest(request);
    this.#render();
  }

  validate() {
    return this.session.validate();
  }

  markClean() {
    this.session.markClean();
  }

  async #emitChange(kind = "change") {
    await this.onChange?.({ kind, blueprint: this.value, request: this.request, validation: this.validate(), dirty: this.isDirty });
  }

  #syncRequestFromForm() {
    if (!this.container) return;
    const root = this.container;
    const request = this.api.createRequest(this.session.request);
    const get = (name) => root.querySelector(`[name="${name}"]`);
    request.identity.name = get("name")?.value ?? "";
    request.identity.level = number(get("level")?.value);
    request.identity.role = get("role")?.value ?? "custom";
    request.identity.category = get("category")?.value ?? "humanoid";
    request.identity.subtypes = String(get("subtypes")?.value ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    request.identity.size = get("size")?.value ?? "med";
    request.defenses.ac = get("ac")?.value ?? "role";
    request.defenses.hp = get("hp")?.value ?? "role";
    request.defenses.perception = get("perception")?.value ?? "role";
    request.defenses.saves.fortitude = get("fortitude")?.value ?? "role";
    request.defenses.saves.reflex = get("reflex")?.value ?? "role";
    request.defenses.saves.will = get("will")?.value ?? "role";
    request.generation.seed = get("seed")?.value ?? "";
    request.generation.variation = get("variation")?.value ?? "balanced";
    request.options.attackCount = number(get("attackCount")?.value || 1);
    this.session.setRequest(request);
  }

  async #handleEvent(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
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
      } else if (action === "create-actor" && this.capabilities.actorCreation) {
        const { actor } = await this.api.createActor(this.session.blueprint, { renderSheet: true });
        globalThis.ui?.notifications?.info?.(localize("PF2E_CREATURE_FORGE.Notifications.ActorCreated", `Created ${actor?.name ?? "creature"}.`));
      }
      return;
    }

    if (event.type === "change" || (event.type === "input" && target.matches?.('input[name="name"], input[name="seed"], input[name="subtypes"]'))) {
      this.#syncRequestFromForm();
      await this.#emitChange("request-change");
    }
  }

  #render() {
    if (!this.container) return;
    if (this.boundHandler) {
      this.container.removeEventListener("change", this.boundHandler);
      this.container.removeEventListener("input", this.boundHandler);
      this.container.removeEventListener("click", this.boundHandler);
      this.boundHandler = null;
    }
    const request = this.session.request;
    const blueprint = this.session.blueprint;
    const validation = this.validate();
    const categories = this.api.content.list("category").map((entry) => ({ value: entry.slug ?? entry.id, label: localize(entry.label, entry.slug ?? entry.id) }));
    const integrationStatus = this.api.integrations.getStatus();
    const statusRows = Object.entries(integrationStatus).map(([key, status]) => {
      const state = status.ready ? "ready" : status.active ? "partial" : "missing";
      return `<li class="cf-integration ${state}"><span>${escapeHtml(localize(`PF2E_CREATURE_FORGE.Integration.${key}`, key))}</span><strong>${escapeHtml(status.version || "—")}</strong></li>`;
    }).join("");
    const diagnostics = [...(validation.request.issues ?? []), ...(validation.blueprint.issues ?? [])];
    const diagnosticsHtml = diagnostics.length
      ? `<ul class="cf-diagnostics">${diagnostics.map((entry) => `<li class="${entry.level}">${escapeHtml(entry.message)}</li>`).join("")}</ul>`
      : `<p class="cf-ok">${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Valid", "Blueprint valid"))}</p>`;

    this.container.innerHTML = `
      <section class="cf-editor cf-layout-${escapeHtml(this.layout)}" data-cf-editor>
        <div class="cf-grid">
          <section class="cf-panel cf-inputs">
            <h3>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Concept", "Concept"))}</h3>
            <div class="cf-form-grid">
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Name", "Name"))}</span><input name="name" type="text" value="${escapeHtml(request.identity.name)}" ${this.mode === "view" ? "disabled" : ""}></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Level", "Level"))}</span><input name="level" type="number" min="-1" max="24" step="1" value="${request.identity.level}" ${this.mode === "view" ? "disabled" : ""}></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Role", "Role"))}</span><select name="role" ${this.mode === "view" ? "disabled" : ""}>${roleOptions(request.identity.role)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Category", "Category"))}</span><select name="category" ${this.mode === "view" ? "disabled" : ""}>${categories.map((entry) => option(entry.value, entry.label, request.identity.category)).join("")}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Subtypes", "Subtypes"))}</span><input name="subtypes" type="text" value="${escapeHtml(request.identity.subtypes.join(", "))}" placeholder="aquatic, fire" ${this.mode === "view" ? "disabled" : ""}></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Size", "Size"))}</span><select name="size" ${this.mode === "view" ? "disabled" : ""}>${sizeOptions(request.identity.size)}</select></label>
            </div>

            <h3>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Defenses", "Defenses"))}</h3>
            <div class="cf-form-grid">
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.AC", "AC"))}</span><select name="ac" ${this.mode === "view" ? "disabled" : ""}>${rankOptions(request.defenses.ac, RANKS.DEFENSE)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.HP", "HP"))}</span><select name="hp" ${this.mode === "view" ? "disabled" : ""}>${rankOptions(request.defenses.hp, RANKS.HP)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Perception", "Perception"))}</span><select name="perception" ${this.mode === "view" ? "disabled" : ""}>${rankOptions(request.defenses.perception, RANKS.SAVE)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Fortitude", "Fortitude"))}</span><select name="fortitude" ${this.mode === "view" ? "disabled" : ""}>${rankOptions(request.defenses.saves.fortitude, RANKS.SAVE)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Reflex", "Reflex"))}</span><select name="reflex" ${this.mode === "view" ? "disabled" : ""}>${rankOptions(request.defenses.saves.reflex, RANKS.SAVE)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Will", "Will"))}</span><select name="will" ${this.mode === "view" ? "disabled" : ""}>${rankOptions(request.defenses.saves.will, RANKS.SAVE)}</select></label>
            </div>

            <h3>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Generation", "Generation"))}</h3>
            <div class="cf-form-grid">
              <label class="cf-wide"><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Seed", "Seed"))}</span><input name="seed" type="text" value="${escapeHtml(request.generation.seed)}" placeholder="${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.AutoSeed", "automatic"))}" ${this.mode === "view" ? "disabled" : ""}></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Variation", "Variation"))}</span><select name="variation" ${this.mode === "view" ? "disabled" : ""}>${["conservative","balanced","experimental"].map((value) => option(value, localize(`PF2E_CREATURE_FORGE.Variation.${value}`, value), request.generation.variation)).join("")}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.AttackCount", "Attacks"))}</span><select name="attackCount" ${this.mode === "view" ? "disabled" : ""}>${option("1", "1", String(request.options.attackCount))}${option("2", "2", String(request.options.attackCount))}</select></label>
            </div>

            ${this.capabilities.generation && this.mode !== "view" ? `<div class="cf-actions"><button type="button" data-cf-action="generate"><i class="fa-solid fa-hammer"></i> ${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.Generate", "Generate"))}</button><button type="button" data-cf-action="reroll-all"><i class="fa-solid fa-dice"></i> ${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.Reroll", "Reroll"))}</button></div>` : ""}
          </section>

          <section class="cf-panel cf-preview">
            <div class="cf-preview-header"><div><h3>${escapeHtml(blueprint?.identity?.name || localize("PF2E_CREATURE_FORGE.Untitled", "Creature"))}</h3><p>${escapeHtml(localize(`PF2E_CREATURE_FORGE.Role.${blueprint?.identity?.role}`, blueprint?.identity?.role ?? "custom"))} · ${escapeHtml(localize(`PF2E_CREATURE_FORGE.Size.${blueprint?.identity?.size}`, blueprint?.identity?.size ?? "med"))} · ${escapeHtml(blueprint?.identity?.traits?.join(", ") ?? "")}</p></div><span class="cf-level">${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Level", "Level"))} ${blueprint?.identity?.level ?? "—"}</span></div>
            <dl class="cf-stat-grid">
              <div><dt>RK / AC</dt><dd>${blueprint?.statistics?.ac?.value ?? "—"} <small>${escapeHtml(localize(`PF2E_CREATURE_FORGE.Rank.${blueprint?.statistics?.ac?.rank}`, blueprint?.statistics?.ac?.rank ?? ""))}</small></dd></div>
              <div><dt>TP / HP</dt><dd>${blueprint?.statistics?.hp?.value ?? "—"} <small>${escapeHtml(localize(`PF2E_CREATURE_FORGE.Rank.${blueprint?.statistics?.hp?.rank}`, blueprint?.statistics?.hp?.rank ?? ""))}</small> ${this.capabilities.generation && this.mode !== "view" ? `<button type="button" class="cf-icon-button" title="Reroll HP" data-cf-action="reroll-hp"><i class="fa-solid fa-dice"></i></button>` : ""}</dd></div>
              <div><dt>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Perception", "Perception"))}</dt><dd>+${blueprint?.statistics?.perception?.value ?? "—"}</dd></div>
              <div><dt>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Fortitude", "Fortitude"))}</dt><dd>+${blueprint?.statistics?.saves?.fortitude?.value ?? "—"}</dd></div>
              <div><dt>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Reflex", "Reflex"))}</dt><dd>+${blueprint?.statistics?.saves?.reflex?.value ?? "—"}</dd></div>
              <div><dt>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Will", "Will"))}</dt><dd>+${blueprint?.statistics?.saves?.will?.value ?? "—"}</dd></div>
            </dl>
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
            ${this.capabilities.actorCreation && this.mode !== "view" ? `<div class="cf-actions"><button type="button" data-cf-action="create-actor"><i class="fa-solid fa-user-plus"></i> ${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.CreateActor", "Create actor"))}</button></div>` : ""}
          </section>
        </div>
      </section>`;

    this.boundHandler = this.#handleEvent.bind(this);
    this.container.addEventListener("change", this.boundHandler);
    this.container.addEventListener("input", this.boundHandler);
    this.container.addEventListener("click", this.boundHandler);
  }
}

export function createCreatureEditorUiApi({ apiProvider }) {
  return {
    contractVersion: EmbeddedCreatureEditor.CONTRACT_VERSION,
    createSession: (options = {}) => new CreatureEditorSession({ api: apiProvider(), ...options }),
    create: (options = {}) => new EmbeddedCreatureEditor({ api: apiProvider(), ...options })
  };
}
