/**
 * Pós-processamento do transcript Whisper (PT-BR).
 *
 * O modelo multilíngue `small` ainda troca palavras comuns do assistente
 * (ex.: “atual” → “outdoor”). Correções só no caminho Whisper — Windows Speech
 * não passa por aqui.
 *
 * Regras conservadoras: frase/contexto conhecido; sem reescrever o enunciado inteiro.
 */

/** Alucinações curtas frequentes do Whisper em silêncio / áudio ruim. */
const HALLUCINATION_ONLY = [
  /^thanks for watching\.?$/i,
  /^thank you\.?$/i,
  /^thanks\.?$/i,
  /^subscribe\.?$/i,
  /^legenda(s)?( gerada(s)? automaticamente)?\.?$/i,
  /^subtitulado?s? pela comunidade amara\.?org\.?$/i,
]

/**
 * “outdoor” no lugar de “atual” (clima / hora / tempo).
 * Mantém “outdoor” se a frase não for desse domínio.
 */
const OUTDOOR_AS_ATUAL =
  /\b(clima|tempo|hor[aá]rio|hora|agora|hoje|momento)\b([^,.!?]{0,40}?)\boutdoor\b/gi

const ATUAL_AS_OUTDOOR_FLIP =
  /\boutdoor\b([^,.!?]{0,40}?)\b(clima|tempo|hor[aá]rio|hora)\b/gi

export function isWhisperHallucinationOnly(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return HALLUCINATION_ONLY.some((re) => re.test(t))
}

/**
 * Normaliza mangling PT-BR conhecido do Whisper.
 * Devolve string vazia se for alucinação óbvia sem conteúdo útil.
 */
export function normalizeWhisperPtBr(raw: string): string {
  let text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return ''

  if (isWhisperHallucinationOnly(text)) {
    return ''
  }

  text = text.replace(OUTDOOR_AS_ATUAL, (_m, head: string, mid: string) => {
    return `${head}${mid}atual`
  })

  text = text.replace(ATUAL_AS_OUTDOOR_FLIP, (_m, mid: string, tail: string) => {
    return `atual${mid}${tail}`
  })

  // Caso solto muito comum nos testes do Elio: “qual é o clima outdoor”
  // (já coberto acima) e “clima outdoor de agora”.
  text = text.replace(/\bclima\s+outdoor\b/gi, 'clima atual')
  text = text.replace(/\btempo\s+outdoor\b/gi, 'tempo atual')
  text = text.replace(/\bhor[aá]rio\s+outdoor\b/gi, 'horário atual')

  return text.replace(/\s+/g, ' ').trim()
}
