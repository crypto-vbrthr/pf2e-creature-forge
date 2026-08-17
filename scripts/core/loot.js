import { deepClone } from "./clone.js";

const CHANNELS = Object.freeze(["equipment", "salvage", "hoard", "signature"]);
const MODES = new Set(["auto", "none", "required"]);

const CATEGORY_CHANCES = Object.freeze({
  humanoid: { equipment: 0.82, salvage: 0.08, hoard: 0.24, signature: 0.26 },
  giant: { equipment: 0.48, salvage: 0.18, hoard: 0.34, signature: 0.22 },
  dragon: { equipment: 0.04, salvage: 0.82, hoard: 0.78, signature: 0.30 },
  animal: { equipment: 0.00, salvage: 0.64, hoard: 0.03, signature: 0.00 },
  beast: { equipment: 0.03, salvage: 0.70, hoard: 0.08, signature: 0.03 },
  construct: { equipment: 0.16, salvage: 0.74, hoard: 0.12, signature: 0.12 },
  undead: { equipment: 0.24, salvage: 0.38, hoard: 0.30, signature: 0.20 },
  fey: { equipment: 0.32, salvage: 0.18, hoard: 0.28, signature: 0.30 },
  fiend: { equipment: 0.34, salvage: 0.12, hoard: 0.28, signature: 0.34 },
  celestial: { equipment: 0.34, salvage: 0.08, hoard: 0.18, signature: 0.30 },
  monitor: { equipment: 0.30, salvage: 0.10, hoard: 0.20, signature: 0.28 },
  aberration: { equipment: 0.12, salvage: 0.48, hoard: 0.18, signature: 0.16 },
  elemental: { equipment: 0.02, salvage: 0.44, hoard: 0.08, signature: 0.08 },
  fungus: { equipment: 0.00, salvage: 0.56, hoard: 0.05, signature: 0.00 },
  plant: { equipment: 0.00, salvage: 0.52, hoard: 0.05, signature: 0.00 },
  ooze: { equipment: 0.00, salvage: 0.32, hoard: 0.06, signature: 0.00 },
  astral: { equipment: 0.18, salvage: 0.18, hoard: 0.20, signature: 0.22 },
  ethereal: { equipment: 0.12, salvage: 0.16, hoard: 0.18, signature: 0.22 }
});

const ROLE_MODIFIERS = Object.freeze({
  spellcaster: { equipment: 0.05, hoard: 0.08, signature: 0.32 },
  magicalStriker: { equipment: 0.10, signature: 0.20 },
  soldier: { equipment: 0.18, signature: 0.08 },
  sniper: { equipment: 0.16, signature: 0.08 },
  brute: { equipment: 0.08, hoard: 0.06 },
  skillParagon: { equipment: 0.12, signature: 0.10 },
  skirmisher: { equipment: 0.10, signature: 0.06 },
  custom: {}
});

const VARIATION_MODIFIER = Object.freeze({ conservative: -0.08, balanced: 0, experimental: 0.10 });

function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, Number(value) || 0)); }
function mode(value) { return MODES.has(value) ? value : "auto"; }

export function lootChannelChance({ channel, category, roleId, variation = "balanced", level = 1, hasSpellcasting = false } = {}) {
  const categoryChance = CATEGORY_CHANCES[category]?.[channel] ?? ({ equipment: 0.15, salvage: 0.20, hoard: 0.15, signature: 0.12 }[channel] ?? 0);
  const roleMod = ROLE_MODIFIERS[roleId]?.[channel] ?? 0;
  const levelMod = channel === "signature" ? clamp((Number(level) - 4) * 0.012, 0, 0.18) : channel === "hoard" ? clamp((Number(level) - 5) * 0.008, 0, 0.12) : 0;
  const spellMod = channel === "signature" && hasSpellcasting ? 0.10 : 0;
  return clamp(categoryChance + roleMod + levelMod + spellMod + (VARIATION_MODIFIER[variation] ?? 0));
}

function selectionReason(channel, selectedMode, selected, chance) {
  if (selectedMode === "required") return "required";
  if (selectedMode === "none") return "disabled";
  return selected ? `auto:${chance.toFixed(2)}` : `auto-none:${chance.toFixed(2)}`;
}

export function createLootPlan({ request, blueprint, random } = {}) {
  const root = request?.loot ?? {};
  const rootMode = mode(root.mode ?? request?.options?.loot ?? "auto");
  const category = blueprint?.identity?.category ?? request?.identity?.category ?? "humanoid";
  const roleId = blueprint?.identity?.role ?? request?.identity?.role ?? "custom";
  const level = Number(blueprint?.identity?.level ?? request?.identity?.level ?? 1);
  const variation = request?.generation?.variation ?? "balanced";
  const hasSpellcasting = Boolean(blueprint?.combat?.spellcasting?.length);
  const plan = {
    schemaVersion: 2,
    policy: rootMode,
    generated: false,
    environment: String(root.environment ?? "generic"),
    treasureProfile: String(root.treasureProfile ?? "standard"),
    useItemForge: root.useItemForge !== false,
    sourceCompendiums: [...new Set((request?.sources?.loot ?? []).map(String).filter(Boolean))],
    channels: {},
    diagnostics: [],
    summary: { selectedChannels: [], generatedChannels: [], carriedItemCount: 0, deferredItemCount: 0, totalValueGp: 0 }
  };

  if (rootMode === "none") {
    for (const channel of CHANNELS) plan.channels[channel] = { mode: "none", selected: false, chance: 0, reason: "root-disabled", result: null };
    return plan;
  }

  for (const channel of CHANNELS) {
    const channelMode = mode(root?.[channel]?.mode ?? "auto");
    const chance = lootChannelChance({ channel, category, roleId, variation, level, hasSpellcasting });
    const selected = channelMode === "required" || (channelMode === "auto" && random?.fork?.(`loot.${channel}`)?.bool?.(chance));
    plan.channels[channel] = { mode: channelMode, selected: Boolean(selected), chance, reason: selectionReason(channel, channelMode, selected, chance), result: null };
  }

  if (rootMode === "required" && !CHANNELS.some((channel) => plan.channels[channel].selected)) {
    const candidates = CHANNELS.filter((channel) => plan.channels[channel].mode !== "none")
      .sort((a, b) => plan.channels[b].chance - plan.channels[a].chance);
    if (candidates.length) {
      plan.channels[candidates[0]].selected = true;
      plan.channels[candidates[0]].reason = "root-required";
    } else {
      plan.diagnostics.push({ level: "warning", code: "REQUIRED_LOOT_UNAVAILABLE", message: "Loot is required but every loot channel is disabled." });
    }
  }

  plan.summary.selectedChannels = CHANNELS.filter((channel) => plan.channels[channel].selected);
  return plan;
}

export function rerollLootPlan({ request, blueprint, random } = {}) {
  const next = createLootPlan({ request, blueprint, random });
  const old = blueprint?.loot ?? {};
  for (const channel of CHANNELS) {
    if (old?.channels?.[channel]?.locked) {
      next.channels[channel] = deepClone(old.channels[channel]);
      next.channels[channel].result = deepClone(old.channels[channel].result ?? null);
    }
  }
  next.summary.selectedChannels = CHANNELS.filter((channel) => next.channels[channel]?.selected);
  return next;
}

export function rerollLootChannel({ request, blueprint, random, channel } = {}) {
  if (!CHANNELS.includes(channel)) throw new Error(`Unknown loot channel: ${channel}`);
  const old = blueprint?.loot ?? {};
  if (old?.channels?.[channel]?.locked) return deepClone(old);
  const generated = createLootPlan({ request, blueprint, random });
  for (const current of CHANNELS) {
    if (current === channel) continue;
    if (old?.channels?.[current]) generated.channels[current] = deepClone(old.channels[current]);
  }
  generated.summary.selectedChannels = CHANNELS.filter((current) => generated.channels[current]?.selected);
  return generated;
}

export const LOOT_CHANNELS = CHANNELS;
