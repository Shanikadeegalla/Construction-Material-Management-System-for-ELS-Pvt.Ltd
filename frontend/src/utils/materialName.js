// Display name of a material. The server now sends Site Store data already decrypted,
// so the browser holds no encryption key. If a value still looks like encrypted text
// (a long hex string), the name is taken from the Item Master by material code instead,
// so raw encrypted text is never shown on screen.
export function isHexString(str) {
  return typeof str === 'string' && str.length >= 16 && /^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0;
}

export function resolveMaterialName(item, itemMasterMap = {}) {
  if (!item) return '';
  if (typeof item === 'string') return isHexString(item) ? '-' : item;

  const code = item.materialCode || item.code || '';
  let resolved = item.name || item.materialName || '';

  if ((!resolved || isHexString(resolved)) && code && itemMasterMap) {
    const match = typeof itemMasterMap.get === 'function' ? itemMasterMap.get(code) : itemMasterMap[code];
    if (match) resolved = typeof match === 'string' ? match : (match.materialName || match.name);
  }
  if (!resolved || isHexString(resolved)) resolved = code || '-';
  return resolved;
}
