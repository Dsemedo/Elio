/**
 * Permissões Chromium/Electron que o Elio concede ao próprio origin.
 * Sem handler, o default costuma ser OK; com handler restrito (ex.: só
 * geolocation), media/fala caem em not-allowed no renderer.
 *
 * SpeechRecognition / getUserMedia pedem `media` e, em builds recentes,
 * também `microphone`. `mediaTypes` no request pode vir omitido — não
 * tratar ausência como negação (ver DeepSeek/Electron 44+).
 */

const ALLOWED = new Set([
  'geolocation',
  'media',
  'microphone',
  'speaker-selection',
])

/** true se o pedido/check de permissão deve ser concedido ao app. */
export function isAppPermissionAllowed(permission: string): boolean {
  return ALLOWED.has(permission)
}

/** Subconjunto dos details do Electron (request/check) relevante a media. */
export type MediaPermissionDetails = {
  mediaTypes?: readonly string[] | string[]
  mediaType?: string
}

/**
 * Para `media`, libera áudio. Video-only (câmera) permanece negado —
 * o Elio só precisa de microfone/fala.
 */
export function isMediaAudioAllowed(
  permission: string,
  details?: MediaPermissionDetails | null,
): boolean {
  if (!isAppPermissionAllowed(permission)) return false
  if (permission !== 'media') return true

  const types = details?.mediaTypes
  if (Array.isArray(types) && types.length > 0) {
    return types.includes('audio')
  }
  // Check handler usa mediaType singular; request pode omitir os dois.
  if (details?.mediaType === 'video') return false
  if (details?.mediaType === 'audio') return true
  // Sem tipos → assume áudio (Speech / getUserMedia audio-only).
  return true
}
