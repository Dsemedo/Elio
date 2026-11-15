/**
 * Permissões Chromium/Electron que o Elio concede ao próprio origin.
 * Sem handler, o default costuma ser OK; com handler restrito (ex.: só
 * geolocation), media/fala caem em not-allowed no renderer.
 */

const ALLOWED = new Set(['geolocation', 'media', 'microphone', 'speaker-selection'])

/** true se o pedido/check de permissão deve ser concedido ao app. */
export function isAppPermissionAllowed(permission: string): boolean {
  return ALLOWED.has(permission)
}
