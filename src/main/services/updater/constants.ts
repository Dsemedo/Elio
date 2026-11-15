/** Intervalo entre checagens de update (arquitetura §9). */
export const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

/**
 * Assinatura de update no Windows.
 * `false` = skip (builds unsigned / sem `publisherName` no feed).
 * Quando houver cert + `publisherName` no electron-builder.yml, mudar para `true`
 * e remover o no-op em `startAutoUpdater`.
 */
export const VERIFY_UPDATE_SIGNATURE = false

/** Env para desligar o updater em builds empacotados (debug). */
export const DISABLE_UPDATER_ENV = 'ELIO_DISABLE_UPDATER'
