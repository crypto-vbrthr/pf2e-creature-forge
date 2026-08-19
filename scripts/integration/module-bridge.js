export function getModuleApi(moduleId) {
  const module = globalThis.game?.modules?.get?.(moduleId);
  return module?.active ? (module.api ?? null) : null;
}

function moduleVersion(moduleId) {
  return String(globalThis.game?.modules?.get?.(moduleId)?.version ?? "");
}

export function integrationStatus(moduleId, capabilities = {}) {
  const module = globalThis.game?.modules?.get?.(moduleId);
  const api = getModuleApi(moduleId);
  const tests = Object.entries(capabilities).map(([name, test]) => {
    let available = false;
    try { available = Boolean(api && test(api)); } catch { available = false; }
    return { name, available };
  });
  const capabilityMap = Object.fromEntries(tests.map(({ name, available }) => [name, available]));
  const missingCapabilities = tests.filter(({ available }) => !available).map(({ name }) => name);
  const active = Boolean(module?.active);
  const ready = Boolean(api);
  return {
    id: moduleId,
    active,
    ready,
    complete: ready && missingCapabilities.length === 0,
    version: moduleVersion(moduleId),
    apiVersion: String(api?.version ?? api?.apiVersion ?? ""),
    capabilities: capabilityMap,
    missingCapabilities
  };
}
