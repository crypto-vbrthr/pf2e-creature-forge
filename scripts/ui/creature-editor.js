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
  static CONTRACT_VERSION = 2;

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
    this.root = null;
    this.scrollElement = null;
    this.boundHandler = null;
  }

  get value() { return deepClone(this.session.blueprint); }
  get request() { return deepClone(this.session.request); }
  get isDirty() { return Boolean(this.session.dirty); }
  get element() { return this.root; }

  async mount(container, options = {}) {
    if (!(container instanceof HTMLElement)) throw new TypeError("Creature editor host must be an HTMLElement.");
    this.unmount();
    this.container = container;
    this.container.classList.add("cf-editor-mount");
    if (options.layout) this.layout = options.layout;
    if (Number.isFinite(Number(options.minHeight))) {
      this.container.style.setProperty("--cf-editor-min-height", `${Math.max(320, Number(options.minHeight))}px`);
    }
    if (!this.session.blueprint) this.session.generate();
    this.#render();
    return this;
  }

  unmount({ clearContainer = true } = {}) {
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
    request.identity.subtypes = String(get("subtypes")?.value ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    request.identity.size = get("size")?.value ?? "med";
    for (const ability of ABILITIES) request.attributes[ability] = get(ability)?.value ?? "role";
    request.defenses.ac = get("ac")?.value ?? "role";
    request.defenses.hp = get("hp")?.value ?? "role";
    request.defenses.perception = get("perception")?.value ?? "role";
    request.defenses.saves.fortitude = get("fortitude")?.value ?? "role";
    request.defenses.saves.reflex = get("reflex")?.value ?? "role";
    request.defenses.saves.will = get("will")?.value ?? "role";
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
    request.generation.seed = get("seed")?.value ?? "";
    request.generation.variation = get("variation")?.value ?? "balanced";
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
      } else if (action === "create-actor" && this.capabilities.actorCreation) {
        const { actor } = await this.api.createActor(this.session.blueprint, { renderSheet: true });
        globalThis.ui?.notifications?.info?.(localize("PF2E_CREATURE_FORGE.Notifications.ActorCreated", `Created ${actor?.name ?? "creature"}.`));
      }
      return;
    }

    if (event.type === "change" || (event.type === "input" && target.matches?.('input[name="name"], input[name="seed"], input[name="subtypes"], input[name="preferredSkills"]'))) {
      this.#syncRequestFromForm();
      await this.#emitChange("request-change");
    }
  }

  #render() {
    if (!this.container) return;
    const previousScrollTop = this.scrollElement?.scrollTop ?? 0;
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

    const canGenerate = this.capabilities.generation && this.mode !== "view";
    const canCreateActor = this.capabilities.actorCreation && this.mode !== "view";
    const validationState = validation.request.valid && validation.blueprint.valid ? "valid" : "invalid";

    this.container.innerHTML = `
      <section class="cf-editor cf-layout-${escapeHtml(this.layout)}" data-cf-editor data-cf-editor-contract="${EmbeddedCreatureEditor.CONTRACT_VERSION}">
        <div class="cf-editor-scroll" data-cf-editor-scroll>
          <div class="cf-grid">
          <section class="cf-panel cf-inputs">
            <h3>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Concept", "Concept"))}</h3>
            <div class="cf-form-grid">
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Name", "Name"))}</span><input name="name" type="text" value="${escapeHtml(request.identity.name)}" ${disabled}></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Level", "Level"))}</span><input name="level" type="number" min="-1" max="24" step="1" value="${request.identity.level}" ${disabled}></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Role", "Role"))}</span><select name="role" ${disabled}>${roleOptions(request.identity.role)}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Category", "Category"))}</span><select name="category" ${disabled}>${categories.map((entry) => option(entry.value, entry.label, request.identity.category)).join("")}</select></label>
              <label><span>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Subtypes", "Subtypes"))}</span><input name="subtypes" type="text" value="${escapeHtml(request.identity.subtypes.join(", "))}" placeholder="aquatic, fire" ${disabled}></label>
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
              <div><dt>TP / HP</dt><dd>${blueprint?.statistics?.hp?.value ?? "—"} <small>${escapeHtml(rankLabel(blueprint?.statistics?.hp?.rank))}</small> ${this.capabilities.generation && this.mode !== "view" ? `<button type="button" class="cf-icon-button" title="Reroll HP" data-cf-action="reroll-hp"><i class="fa-solid fa-dice"></i></button>` : ""}</dd></div>
              <div><dt>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Perception", "Perception"))}</dt><dd>${signed(blueprint?.statistics?.perception?.value)}</dd></div>
              <div><dt>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Fortitude", "Fortitude"))}</dt><dd>${signed(blueprint?.statistics?.saves?.fortitude?.value)}</dd></div>
              <div><dt>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Reflex", "Reflex"))}</dt><dd>${signed(blueprint?.statistics?.saves?.reflex?.value)}</dd></div>
              <div><dt>${escapeHtml(localize("PF2E_CREATURE_FORGE.Field.Will", "Will"))}</dt><dd>${signed(blueprint?.statistics?.saves?.will?.value)}</dd></div>
            </dl>

            <div class="cf-heading-row"><h4>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Skills", "Skills"))}</h4>${this.capabilities.generation && this.mode !== "view" ? `<button type="button" class="cf-icon-button" title="${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.RerollSkills", "Reroll skills"))}" data-cf-action="reroll-skills"><i class="fa-solid fa-dice"></i></button>` : ""}</div>
            ${skillRows ? `<ul class="cf-compact-list">${skillRows}</ul>` : `<p class="cf-muted">${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.NoSkills", "No skills generated."))}</p>`}

            <div class="cf-heading-row"><h4>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Movement", "Movement"))}</h4>${this.capabilities.generation && this.mode !== "view" ? `<button type="button" class="cf-icon-button" title="${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.RerollMovement", "Reroll movement"))}" data-cf-action="reroll-movement"><i class="fa-solid fa-dice"></i></button>` : ""}</div>
            <ul class="cf-compact-list">${movementRows}</ul>

            <div class="cf-heading-row"><h4>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Senses", "Senses"))}</h4>${this.capabilities.generation && this.mode !== "view" ? `<button type="button" class="cf-icon-button" title="${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.RerollSenses", "Reroll senses"))}" data-cf-action="reroll-senses"><i class="fa-solid fa-dice"></i></button>` : ""}</div>
            ${senseRows ? `<ul class="cf-compact-list">${senseRows}</ul>` : `<p class="cf-muted">${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.NoSpecialSenses", "No special senses."))}</p>`}

            <div class="cf-heading-row"><h4>${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.Attacks", "Attacks"))}</h4>${this.capabilities.generation && this.mode !== "view" && (blueprint?.combat?.attacks?.length ?? 0) ? `<button type="button" class="cf-icon-button" title="${escapeHtml(localize("PF2E_CREATURE_FORGE.Action.RerollAttacks", "Reroll attacks"))}" data-cf-action="reroll-attacks"><i class="fa-solid fa-dice"></i></button>` : ""}</div>
            ${(blueprint?.combat?.attacks?.length ?? 0) ? `<ul class="cf-attacks">${attackRows}</ul>` : `<p class="cf-muted">${escapeHtml(localize("PF2E_CREATURE_FORGE.Editor.NoAttacks", "No strikes generated."))}</p>`}

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
  }
}

export function createCreatureEditorUiApi({ apiProvider }) {
  return {
    contractVersion: EmbeddedCreatureEditor.CONTRACT_VERSION,
    modes: Object.freeze(["create", "edit", "view"]),
    layouts: Object.freeze(["full", "compact"]),
    createSession: (options = {}) => new CreatureEditorSession({ api: apiProvider(), ...options }),
    create: (options = {}) => new EmbeddedCreatureEditor({ api: apiProvider(), ...options })
  };
}
