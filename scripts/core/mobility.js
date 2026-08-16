function isExplicitNumber(value) {
  return typeof value === "number" && Number.isFinite(value) || /^\d+$/.test(String(value ?? ""));
}

function explicitSpeed(value) {
  if (!isExplicitNumber(value)) return null;
  return Math.max(0, Math.round(Number(value)));
}

function speedEntry(type, value, source = "generated") {
  return { type, value: Math.max(0, Math.round(value)), source, locked: false };
}

function resolveTriState(setting, autoValue) {
  if (setting === true || setting === "on" || setting === "yes") return true;
  if (setting === false || setting === "off" || setting === "no") return false;
  return autoValue;
}

function chanceByVariation(request, conservative, balanced, experimental) {
  const variation = request.generation?.variation ?? "balanced";
  return variation === "conservative" ? conservative : variation === "experimental" ? experimental : balanced;
}

export function generateMovement(request, role, level, random) {
  const landSetting = request.movement?.land ?? "role";
  const land = explicitSpeed(landSetting) ?? Number(role.speed ?? 25);
  const other = [];
  const subtypes = new Set(request.identity.subtypes ?? []);
  const category = request.identity.category;

  const resolve = (type, auto) => {
    const setting = request.movement?.[type] ?? "auto";
    const explicit = explicitSpeed(setting);
    if (explicit !== null) return explicit > 0 ? explicit : 0;
    if (setting === "none" || setting === "off") return 0;
    return Math.max(0, Math.round(auto()));
  };

  const swim = resolve("swim", () => {
    if (subtypes.has("aquatic") || subtypes.has("amphibious") || subtypes.has("water")) return Math.max(20, land);
    if (["animal", "beast"].includes(category) && random.fork("swim").chance(chanceByVariation(request, 0.05, 0.12, 0.25))) return Math.max(15, land - 5);
    return 0;
  });
  if (swim) other.push(speedEntry("swim", swim));

  const climb = resolve("climb", () => {
    if (["animal", "beast", "aberration"].includes(category) && random.fork("climb").chance(chanceByVariation(request, 0.12, 0.25, 0.4))) return Math.max(15, land - 5);
    if (role.id === "skirmisher" && random.fork("climb-skirmisher").chance(0.25)) return Math.max(15, land - 10);
    return 0;
  });
  if (climb) other.push(speedEntry("climb", climb));

  const fly = resolve("fly", () => {
    if (subtypes.has("air") || subtypes.has("incorporeal")) return Math.max(25, land);
    if (category === "dragon" && level >= 7) return Math.max(30, land + 5);
    if (["celestial", "fiend", "fey"].includes(category) && level >= 7 && random.fork("fly-outsider").chance(chanceByVariation(request, 0.15, 0.35, 0.55))) return Math.max(25, land);
    return 0;
  });
  if (fly) other.push(speedEntry("fly", fly));

  const burrow = resolve("burrow", () => {
    if (subtypes.has("earth")) return Math.max(15, land - 10);
    if (["animal", "beast"].includes(category) && random.fork("burrow").chance(chanceByVariation(request, 0.03, 0.08, 0.18))) return Math.max(10, land - 15);
    return 0;
  });
  if (burrow) other.push(speedEntry("burrow", burrow));

  return { land, other };
}

export function generateSenses(request, level, random) {
  const subtypes = new Set(request.identity.subtypes ?? []);
  const category = request.identity.category;

  const darkAuto = (() => {
    if (subtypes.has("incorporeal")) return true;
    if (category === "undead") return random.fork("dark-undead").chance(chanceByVariation(request, 0.65, 0.82, 0.92));
    if (["aberration", "fiend", "celestial"].includes(category)) return random.fork("dark-outsider").chance(chanceByVariation(request, 0.35, 0.55, 0.72));
    if (category === "dragon") return random.fork("dark-dragon").chance(0.5);
    return false;
  })();
  const darkvision = resolveTriState(request.senses?.darkvision ?? "auto", darkAuto);

  const lowAuto = !darkvision && (["animal", "beast", "fey", "dragon"].includes(category)
    ? random.fork("low-light").chance(chanceByVariation(request, 0.55, 0.75, 0.9))
    : false);
  const lowLight = resolveTriState(request.senses?.lowLightVision ?? "auto", lowAuto);

  const scentAuto = ["animal", "beast"].includes(category)
    ? random.fork("scent").chance(chanceByVariation(request, 0.45, 0.68, 0.85))
    : false;
  const scent = resolveTriState(request.senses?.scent ?? "auto", scentAuto);

  const result = [];
  if (darkvision) result.push({ type: "darkvision", acuity: "precise", range: null, source: "generated", locked: false });
  else if (lowLight) result.push({ type: "low-light-vision", acuity: "precise", range: null, source: "generated", locked: false });
  if (scent) {
    const range = Math.max(5, Math.round(Number(request.senses?.scentRange ?? 30) / 5) * 5);
    result.push({ type: "scent", acuity: "imprecise", range, source: "generated", locked: false });
  }
  return result;
}
