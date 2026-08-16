export function getModuleApi(moduleId) {
  const module = globalThis.game?.modules?.get?.(moduleId);
  return module?.active ? (module.api ?? null) : null;
}

function moduleVersion(moduleId) {
  return String(globalThis.game?.modules?.get?.(moduleId)?.version ?? "");
}

export function integrationStatus(moduleId, capabilities = {}) {
  const api = getModuleApi(moduleId);
  const tests = Object.entries(capabilities).map(([name, test]) => {
    let available = false;
    try { available = Boolean(api && test(api)); } catch { available = false; }
    return { name, available };
  });
  return {
    id: moduleId,
    active: Boolean(globalThis.game?.modules?.get?.(moduleId)?.active),
    ready: Boolean(api),
    version: moduleVersion(moduleId),
    apiVersion: String(api?.version ?? api?.apiVersion ?? ""),
    capabilities: Object.fromEntries(tests.map(({ name, available }) => [name, available]))
  };
}
