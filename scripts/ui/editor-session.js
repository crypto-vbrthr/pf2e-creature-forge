import { deepClone, deepMerge } from "../core/clone.js";
import { createGenerationRequest } from "../core/schemas.js";

export class CreatureEditorSession {
  constructor({ api, request = null, blueprint = null, mode = "create" } = {}) {
    if (!api) throw new Error("CreatureEditorSession requires the Creature Forge API.");
    this.api = api;
    this.mode = mode;
    this.blueprint = blueprint ? deepClone(blueprint) : null;
    // Embedded hosts commonly reopen a persisted Creature Forge blueprint
    // without also passing its original request. Rehydrate the editor request
    // from blueprint provenance so controls, source selections, and rerolls
    // reflect the creature that is actually being edited. createGenerationRequest
    // also normalizes older request snapshots onto the current request schema.
    const initialRequest = request ?? this.blueprint?.metadata?.requestSnapshot ?? {};
    this.request = createGenerationRequest(initialRequest);
    this.initial = this.snapshot();
    this.dirty = false;
  }

  snapshot() {
    return { request: deepClone(this.request), blueprint: deepClone(this.blueprint) };
  }

  setRequest(request, { dirty = true } = {}) {
    this.request = createGenerationRequest(request);
    this.dirty = dirty;
    return this.request;
  }

  patchRequest(patch, { dirty = true } = {}) {
    const next = this.api.createRequest(deepMerge(this.request, patch));
    return this.setRequest(next, { dirty });
  }

  generate() {
    this.blueprint = this.api.generate(this.request);
    this.request = deepClone(this.blueprint.metadata.requestSnapshot);
    this.dirty = true;
    return this.blueprint;
  }

  async generateAsync() {
    this.blueprint = await this.api.generateAsync(this.request);
    this.request = deepClone(this.blueprint.metadata.requestSnapshot);
    this.dirty = true;
    return this.blueprint;
  }

  async rerollAsync(options = {}) {
    if (!this.blueprint) return this.generateAsync();
    this.blueprint = await (this.api.rerollAsync ? this.api.rerollAsync(this.blueprint, options) : this.api.reroll(this.blueprint, options));
    this.request = deepClone(this.blueprint.metadata.requestSnapshot);
    this.dirty = true;
    return this.blueprint;
  }

  reroll(options = {}) {
    if (!this.blueprint) return this.generate();
    this.blueprint = this.api.reroll(this.blueprint, options);
    this.request = deepClone(this.blueprint.metadata.requestSnapshot);
    this.dirty = true;
    return this.blueprint;
  }

  validate() {
    return {
      request: this.api.validateRequest(this.request),
      blueprint: this.blueprint ? this.api.validate(this.blueprint) : { valid: true, errors: [], warnings: [], issues: [] }
    };
  }

  markClean() {
    this.initial = this.snapshot();
    this.dirty = false;
  }

  reset() {
    const initial = deepClone(this.initial);
    this.request = initial.request;
    this.blueprint = initial.blueprint;
    this.dirty = false;
  }
}
