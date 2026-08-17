import { MODULE_ID } from "../constants.js";
import { deepClone } from "../core/clone.js";
import { LOOT_CHANNELS } from "../core/loot.js";

function serializeError(error) {
  return { name: error?.name ?? "Error", message: error?.message ?? String(error), errorCode: error?.code ?? null };
}

function itemLevelRange(level) {
  const value = Number(level ?? 1);
  return { min: Math.max(0, value - 2), max: Math.max(0, value + 1) };
}

function sourcePolicy(compendiums = []) {
  const ids = [...new Set((compendiums ?? []).map(String).filter(Boolean))];
  return ids.length ? { mode: "selected", includePacks: ids, excludePacks: [] } : { mode: "system", includePacks: [], excludePacks: [] };
}

function signatureRequest(blueprint, request) {
  const level = Number(blueprint?.identity?.level ?? 1);
  const range = itemLevelRange(level);
  const spellcasting = blueprint?.combat?.spellcasting?.[0] ?? null;
  const attackKind = blueprint?.combat?.attacks?.[0]?.kind ?? "melee";
  const source = sourcePolicy(request?.sources?.loot ?? []);
  const seed = `${blueprint?.metadata?.seed ?? "creature"}:signature`;
  const magicTheme = spellcasting?.themes?.[0] ?? request?.spellcasting?.themes?.[0] ?? "automatic";

  if (spellcasting && level >= 4 && spellcasting.style === "prepared") {
    return { mode: "magic", category: "magic.grimoire", level: range, levelPolicy: "nearest", source, seed, magic: { grimoireMode: "existing", theme: magicTheme } };
  }
  if (spellcasting && level >= 3) {
    return { mode: "magic", category: "magic.wand", level: range, levelPolicy: "nearest", source, seed, magic: { theme: magicTheme, allowHeightened: true } };
  }
  return {
    mode: "equipment",
    category: attackKind === "ranged" ? "weapon.ranged" : "weapon.melee",
    level: range,
    levelPolicy: "nearest",
    source,
    seed,
    equipment: { fundamentalRunes: "automatic", propertyRunes: { mode: "automatic" } }
  };
}

function salvageDefinition(blueprint) {
  const category = blueprint?.identity?.category ?? "creature";
  const level = Number(blueprint?.identity?.level ?? 1);
  const table = {
    animal: ["AnimalParts", "hide"], beast: ["BeastParts", "beast"], dragon: ["DragonParts", "dragon"],
    construct: ["ConstructParts", "construct"], elemental: ["ElementalResidue", "elemental"], fungus: ["FungusParts", "fungus"],
    plant: ["PlantParts", "plant"], undead: ["UndeadRemains", "undead"], ooze: ["OozeResidue", "ooze"],
    aberration: ["AberrantTissue", "aberration"], celestial: ["PlanarRemains", "celestial"], fiend: ["PlanarRemains", "fiend"],
    fey: ["FeyRemains", "fey"], giant: ["GiantParts", "giant"]
  };
  const [label, tag] = table[category] ?? ["CreatureParts", category];
  const count = level >= 12 ? 2 : 1;
  const valueGp = Math.max(1, Math.round(Math.pow(Math.max(1, level + 2), 2) * 0.55));
  return Array.from({ length: count }, (_, index) => ({
    id: `salvage-${index + 1}`,
    nameKey: `PF2E_CREATURE_FORGE.Loot.Salvage.${label}`,
    fallbackName: "Usable creature remains",
    quantity: 1,
    valueGp: Math.max(1, Math.round(valueGp / count)),
    tags: ["salvage", tag],
    source: { moduleId: MODULE_ID, generated: true }
  }));
}

function summarize(plan) {
  const carried = ["equipment", "signature"].flatMap((channel) => plan.channels?.[channel]?.result?.items ?? []);
  const deferred = ["salvage", "hoard"].flatMap((channel) => plan.channels?.[channel]?.result?.items ?? []);
  const hoardValue = Number(plan.channels?.hoard?.result?.loot?.totalValueGp ?? 0);
  const salvageValue = (plan.channels?.salvage?.result?.entries ?? []).reduce((sum, entry) => sum + Number(entry.valueGp ?? 0) * Number(entry.quantity ?? 1), 0);
  plan.summary = {
    selectedChannels: LOOT_CHANNELS.filter((channel) => plan.channels?.[channel]?.selected),
    generatedChannels: LOOT_CHANNELS.filter((channel) => plan.channels?.[channel]?.result),
    carriedItemCount: carried.length,
    deferredItemCount: deferred.length + (plan.channels?.salvage?.result?.entries?.length ?? 0),
    totalValueGp: Math.round((hoardValue + salvageValue) * 100) / 100
  };
}

export class CreatureLootIntegration {
  constructor({ integrations }) { this.integrations = integrations; }

  get available() { return Boolean(this.integrations?.lootApi); }
  get itemForgeAvailable() { return Boolean(this.integrations?.itemApi?.generate); }

  async generateForBlueprint(blueprint, request = blueprint?.metadata?.requestSnapshot ?? {}) {
    const next = deepClone(blueprint);
    const plan = next.loot ?? { policy: "auto", channels: {}, diagnostics: [] };
    plan.diagnostics ??= [];
    const lootApi = this.integrations?.lootApi;
    const itemApi = this.integrations?.itemApi;
    const common = {
      level: next.identity?.level ?? 1,
      traits: next.identity?.traits ?? [],
      role: next.identity?.role ?? "standard",
      environment: plan.environment ?? request?.loot?.environment ?? "generic",
      compendiums: request?.sources?.loot ?? [],
      useItemForge: request?.loot?.useItemForge !== false
    };

    if (plan.channels?.equipment?.selected && !(plan.channels.equipment.locked && plan.channels.equipment.result)) {
      if (lootApi?.generateInventoryForCreature) {
        try {
          const result = await lootApi.generateInventoryForCreature({ ...common, treasureProfile: request?.loot?.treasureProfile ?? "standard", includeCombatGear: true, includeValuables: false, includeCuriosities: false });
          plan.channels.equipment.result = { provider: "loot-forge", items: deepClone(result?.combatGear ?? []), raw: deepClone(result?.raw ?? null) };
        } catch (error) {
          plan.diagnostics.push({ level: "warning", code: "LOOT_EQUIPMENT_GENERATION_FAILED", channel: "equipment", ...serializeError(error) });
        }
      } else {
        plan.diagnostics.push({ level: "warning", code: "LOOT_FORGE_UNAVAILABLE", channel: "equipment", message: "Loot Forge is unavailable; carried equipment was not generated." });
      }
    }

    if (plan.channels?.salvage?.selected && !(plan.channels.salvage.locked && plan.channels.salvage.result)) {
      plan.channels.salvage.result = { provider: MODULE_ID, entries: salvageDefinition(next), items: [] };
    }

    if (plan.channels?.hoard?.selected && !(plan.channels.hoard.locked && plan.channels.hoard.result)) {
      if (lootApi?.generateLootForCreature) {
        try {
          const result = await lootApi.generateLootForCreature({ ...common, treasureProfile: request?.loot?.hoardProfile ?? "hoard", includeCombatGear: false, includeConsumables: true, includePermanentItems: true, includeValuables: true, includeCuriosities: true });
          plan.channels.hoard.result = { provider: "loot-forge", loot: deepClone(result), items: [...deepClone(result?.pf2eItems ?? []), ...deepClone(result?.generatedItems ?? [])] };
        } catch (error) {
          plan.diagnostics.push({ level: "warning", code: "LOOT_HOARD_GENERATION_FAILED", channel: "hoard", ...serializeError(error) });
        }
      } else {
        plan.diagnostics.push({ level: "warning", code: "LOOT_FORGE_UNAVAILABLE", channel: "hoard", message: "Loot Forge is unavailable; hoard loot was not generated." });
      }
    }

    if (plan.channels?.signature?.selected && !(plan.channels.signature.locked && plan.channels.signature.result)) {
      let generatedSignature = false;
      if (request?.loot?.useItemForge !== false && itemApi?.generate) {
        try {
          const generated = await itemApi.generate(signatureRequest(next, request));
          const source = generated?.itemSource ? deepClone(generated.itemSource) : null;
          if (source) {
            plan.channels.signature.result = { provider: "item-forge", items: [source], metadata: deepClone(generated?.metadata ?? {}) };
            generatedSignature = true;
          } else {
            plan.diagnostics.push({ level: "warning", code: "SIGNATURE_ITEM_EMPTY", channel: "signature", message: "Item Forge returned no signature item; trying Loot Forge fallback." });
          }
        } catch (error) {
          plan.diagnostics.push({ level: "warning", code: "SIGNATURE_ITEM_GENERATION_FAILED", channel: "signature", ...serializeError(error) });
        }
      }
      if (!generatedSignature && lootApi?.generateInventoryForCreature) {
        try {
          const result = await lootApi.generateInventoryForCreature({ ...common, treasureProfile: "boss", includeCombatGear: true, includeValuables: false, includeCuriosities: false });
          const candidates = result?.combatGear ?? [];
          const source = candidates[0] ? deepClone(candidates[0]) : null;
          if (source) {
            plan.channels.signature.result = { provider: "loot-forge-fallback", items: [source] };
            generatedSignature = true;
          }
        } catch (error) {
          plan.diagnostics.push({ level: "warning", code: "SIGNATURE_ITEM_FALLBACK_FAILED", channel: "signature", ...serializeError(error) });
        }
      }
      if (!generatedSignature) {
        plan.diagnostics.push({ level: "warning", code: "SIGNATURE_ITEM_UNAVAILABLE", channel: "signature", message: "No provider could generate a signature item." });
      }
    }

    plan.generated = true;
    summarize(plan);
    next.loot = plan;
    next.diagnostics = [...(next.diagnostics ?? []), ...plan.diagnostics];
    return next;
  }
}
