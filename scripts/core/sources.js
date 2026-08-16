function packDocumentName(pack) {
  return pack?.documentName ?? pack?.metadata?.type ?? pack?.metadata?.documentName ?? "";
}

export function listCompendiumSources({ documentName = null } = {}) {
  const packs = [...(globalThis.game?.packs ?? [])];
  return packs
    .filter((pack) => !documentName || String(packDocumentName(pack)).toLowerCase() === String(documentName).toLowerCase())
    .map((pack) => ({
      id: pack.collection,
      label: pack.metadata?.label ?? pack.title ?? pack.collection,
      documentName: packDocumentName(pack),
      packageName: pack.metadata?.packageName ?? pack.metadata?.package ?? "",
      packageType: pack.metadata?.packageType ?? "",
      locked: Boolean(pack.locked)
    }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}
