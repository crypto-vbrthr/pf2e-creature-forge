import { currentLanguage, localize } from "./i18n.js";

function distanceLabel(feet) {
  const value = Number(feet ?? 0);
  if (currentLanguage() === "de") {
    const metres = value * 0.3;
    return `${Number.isInteger(metres) ? metres : String(metres).replace(".", ",")} m`;
  }
  return `${value} ft.`;
}

const INLINE_TEMPLATE_SHAPES = new Set(["burst", "cone", "emanation", "line"]);

export function abilityAreaTemplateInline(ability) {
  const area = ability?.mechanics?.area;
  const shape = String(area?.shape ?? "");
  const distanceFeet = Number(area?.distanceFeet ?? 0);
  if (!INLINE_TEMPLATE_SHAPES.has(shape) || !Number.isFinite(distanceFeet) || distanceFeet <= 0) return "";

  const parameters = [`type:${shape}`, `distance:${distanceFeet}`];
  const widthFeet = Number(area?.widthFeet ?? 0);
  if (shape === "line" && Number.isFinite(widthFeet) && widthFeet > 5) parameters.push(`width:${widthFeet}`);

  const shapeLabel = localize(`PF2E_CREATURE_FORGE.Area.${shape}`, shape);
  const label = `${distanceLabel(distanceFeet)} ${shapeLabel}`;
  return `@Template[${parameters.join("|")}]{${label}}`;
}

export function abilityMechanicsLabel(ability) {
  const mechanics = ability?.mechanics;
  if (!mechanics) return "";
  const parts = [];
  if (mechanics.area?.shape) {
    const shape = localize(`PF2E_CREATURE_FORGE.Area.${mechanics.area.shape}`, mechanics.area.shape);
    parts.push(`${distanceLabel(mechanics.area.distanceFeet)} ${shape}`);
  }
  if (mechanics.damage?.formula) {
    const type = localize(`PF2E_CREATURE_FORGE.DamageType.${mechanics.damage.type}`, mechanics.damage.type ?? "");
    parts.push(`${mechanics.damage.formula} ${type}`);
  }
  if (mechanics.save?.type) {
    const save = localize(`PF2E_CREATURE_FORGE.Save.${mechanics.save.type}`, mechanics.save.type);
    const basic = mechanics.save.basic ? localize("PF2E_CREATURE_FORGE.Signature.BasicSave", "basic") : "";
    parts.push(`${basic ? `${basic} ` : ""}${save} ${localize("PF2E_CREATURE_FORGE.Signature.DC", "DC")} ${Number(mechanics.save.dc ?? 0)}`);
  }
  if (mechanics.recharge?.formula) {
    parts.push(`${localize("PF2E_CREATURE_FORGE.Signature.Recharge", "Recharge")} ${mechanics.recharge.formula} ${localize("PF2E_CREATURE_FORGE.Signature.Rounds", "rounds")}`);
  }
  return parts.join(" · ");
}
