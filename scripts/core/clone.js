export function deepClone(value) {
  if (value === undefined) return undefined;
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}

export function deepMerge(base, override) {
  const left = deepClone(base ?? {});
  const right = override ?? {};
  if (!right || typeof right !== "object" || Array.isArray(right)) return deepClone(right);
  for (const [key, value] of Object.entries(right)) {
    if (value && typeof value === "object" && !Array.isArray(value) && left?.[key] && typeof left[key] === "object" && !Array.isArray(left[key])) {
      left[key] = deepMerge(left[key], value);
    } else {
      left[key] = deepClone(value);
    }
  }
  return left;
}
