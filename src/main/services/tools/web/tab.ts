/**
 * Bridge da aba ativa do navegador.
 *
 * Sem extensão instalada, o Elio NÃO consegue ler título/URL/conteúdo da aba.
 * CDP (Chrome DevTools Protocol) também ficaria fora do least privilege do MVP.
 * Este módulo documenta o contrato e devolve status honesto.
 */

export type ActiveTabSnapshot = {
  title: string
  url: string
  /** Trecho de texto visível, se a extensão fornecer. */
  textExcerpt?: string
}

export type ActiveTabResult =
  | { available: true; tab: ActiveTabSnapshot; source: 'extension' }
  | {
      available: false
      code: 'extension_missing' | 'extension_unreachable' | 'no_tab'
      message: string
    }

/**
 * Consulta a aba ativa. Hoje: sempre `extension_missing`.
 * Quando houver extensão, este ponto será o único lugar a trocar.
 */
export async function getActiveBrowserTab(): Promise<ActiveTabResult> {
  return {
    available: false,
    code: 'extension_missing',
    message:
      'Ainda não consigo ler a aba aberta do navegador. Isso exige uma extensão do Chrome/Edge conectada ao Elio (não incluída neste MVP). Posso abrir um site (“abre o site …”) ou pesquisar na web (“pesquisa na web sobre …”) com allowlist https.',
  }
}

export function formatActiveTabUnavailable(result: Extract<ActiveTabResult, { available: false }>): string {
  return result.message
}
