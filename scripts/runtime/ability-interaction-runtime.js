import { abilityInteractionInline } from "../ability-presentation.js";
import { buildAbilityDescription } from "../core/compiler.js";
import { MODULE_ID } from "../constants.js";
import { localize } from "../i18n.js";

function actorBlueprint(actor) {
  return actor?.flags?.[MODULE_ID]?.blueprint ?? null;
}

function itemsOf(actor) {
  if (!actor?.items) return [];
  if (Array.isArray(actor.items)) return actor.items;
  if (Array.isArray(actor.items.contents)) return actor.items.contents;
  return [...(actor.items.values?.() ?? [])];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function resolveAbility(actor, abilityId) {
  const blueprint = actorBlueprint(actor);
  const ability = blueprint?.abilities?.find?.((entry) => entry.id === abilityId || entry.contentId === abilityId) ?? null;
  const item = itemsOf(actor).find((entry) => {
    const flags = entry?.flags?.[MODULE_ID] ?? {};
    return flags.abilityId === ability?.id || flags.abilityId === abilityId || flags.contentId === ability?.contentId;
  }) ?? null;
  return { blueprint, ability, item };
}

function abilityName(ability, item) {
  return String(item?.name ?? localize(ability?.nameKey, ability?.name ?? ability?.contentId ?? ability?.id ?? "Ability"));
}

function textEditorImplementation() {
  return globalThis.TextEditor
    ?? globalThis.foundry?.applications?.ux?.TextEditor?.implementation
    ?? globalThis.foundry?.applications?.ux?.TextEditor
    ?? null;
}

async function enrich(content, { actor = null, item = null } = {}) {
  const editor = textEditorImplementation();
  if (typeof editor?.enrichHTML !== "function") return content;
  try {
    return await editor.enrichHTML(content, {
      async: true,
      relativeTo: item ?? actor ?? undefined,
      rollData: actor?.getRollData?.() ?? {}
    });
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not enrich Creature Forge chat content.`, error);
    return content;
  }
}

async function createChatMessage({ actor, item = null, content }) {
  const ChatMessage = globalThis.ChatMessage;
  if (typeof ChatMessage?.create !== "function") throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.ChatUnavailable", "Chat is unavailable."));
  const enriched = await enrich(content, { actor, item });
  const speaker = typeof ChatMessage.getSpeaker === "function" ? ChatMessage.getSpeaker({ actor }) : {};
  return ChatMessage.create({
    user: globalThis.game?.user?.id ?? undefined,
    speaker,
    content: enriched
  });
}

function assertGm() {
  if (globalThis.game?.user?.isGM === false) throw new Error(localize("PF2E_CREATURE_FORGE.Notifications.GmOnly", "Only the GM can use this Creature Forge control."));
}

export class CreatureAbilityInteractionRuntime {
  resolve(actor, abilityId) {
    return resolveAbility(actor, abilityId);
  }

  async sendAbilityToChat({ actor, abilityId } = {}) {
    assertGm();
    if (!actor) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.ActorMissing", "The source creature could not be found."));
    const { blueprint, ability, item } = resolveAbility(actor, abilityId);
    if (!ability) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.AbilityMissing", "The creature ability could not be found."));
    const effectResources = new Map((blueprint?.resources?.effects ?? []).map((resource) => [resource.id, resource]));
    const runtimeLinks = actor?.flags?.[MODULE_ID]?.runtime?.effects ?? {};
    const description = buildAbilityDescription(ability, effectResources, {
      runtimeLinks,
      actorUuid: actor.uuid ?? null,
      runtimeAvailable: false,
      interactionRuntimeAvailable: false,
      renderForChat: true,
      includeShareButton: false
    });
    const name = abilityName(ability, item);
    const content = `<div class="pf2e-creature-forge-chat-card"><h3>${escapeHtml(name)}</h3>${description}</div>`;
    return createChatMessage({ actor, item, content });
  }

  async sendInteractionToChat({ actor, abilityId, interactionIndex } = {}) {
    assertGm();
    if (!actor) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.ActorMissing", "The source creature could not be found."));
    const { ability, item } = resolveAbility(actor, abilityId);
    if (!ability) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.AbilityMissing", "The creature ability could not be found."));
    const index = Number(interactionIndex);
    const interaction = Number.isInteger(index) ? ability.interactions?.[index] : null;
    const inline = abilityInteractionInline(interaction);
    if (!interaction || !inline) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.InteractionMissing", "The interactive roll or action could not be found."));
    const name = abilityName(ability, item);
    const label = localize(interaction.labelKey, interaction.label ?? localize("PF2E_CREATURE_FORGE.Editor.InteractiveActions", "Interactive actions"));
    const content = `<div class="pf2e-creature-forge-chat-card"><strong>${escapeHtml(name)}</strong><p>${escapeHtml(label)}: ${inline}</p></div>`;
    return createChatMessage({ actor, item, content });
  }
}

let uiInitialized = false;

export function initializeAbilityInteractionRuntimeUi(runtime) {
  if (uiInitialized) return;
  uiInitialized = true;
  globalThis.document?.addEventListener?.("click", async (event) => {
    const share = event.target?.closest?.(".pf2e-creature-forge-share-ability");
    const interaction = event.target?.closest?.(".pf2e-creature-forge-chat-interaction");
    const button = share ?? interaction;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled || button.getAttribute?.("aria-disabled") === "true") return;
    try {
      button.disabled = true;
      button.setAttribute?.("aria-disabled", "true");
      const actor = await (globalThis.fromUuid?.(button.dataset.cfActorUuid) ?? null);
      if (!actor) throw new Error(localize("PF2E_CREATURE_FORGE.Runtime.ActorMissing", "The source creature could not be found."));
      if (share) {
        await runtime.sendAbilityToChat({ actor, abilityId: button.dataset.cfAbilityId });
      } else {
        await runtime.sendInteractionToChat({
          actor,
          abilityId: button.dataset.cfAbilityId,
          interactionIndex: Number(button.dataset.cfInteractionIndex)
        });
      }
    } catch (error) {
      console.error(`${MODULE_ID} | Ability chat action failed.`, error);
      globalThis.ui?.notifications?.error?.(error?.message ?? localize("PF2E_CREATURE_FORGE.Runtime.ChatFailed", "The ability could not be sent to chat."));
    } finally {
      button.disabled = false;
      button.removeAttribute?.("aria-disabled");
    }
  }, { capture: true });
}
