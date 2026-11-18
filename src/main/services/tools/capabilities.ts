/**
 * Manifesto de capacidades (ADR 0019 / Fase A0c).
 * Lista versionada: o que o local sabe vs o que exige nuvem BYOK.
 */

import { isOpenRouterConfigured } from '../providers/openrouter'

/** Versão do manifesto — subir quando mudar o contrato local/cloud. */
export const CAPABILITIES_MANIFEST_VERSION = 1

export type CloudKind = 'image' | 'codegen' | 'chat'

export type LocalCapability =
  | 'pc_action'
  | 'local_fact'
  | 'web_context'
  | 'small_talk'
  | 'ollama_chat'

/** O que o Elio atende no PC sem chave do usuário. */
export const LOCAL_CAPABILITIES: readonly LocalCapability[] = [
  'pc_action',
  'local_fact',
  'web_context',
  'small_talk',
  'ollama_chat',
] as const

/** Pedidos que o local não executa sozinho — precisam de provedor conectado. */
export const CLOUD_KINDS: readonly CloudKind[] = [
  'image',
  'codegen',
  'chat',
] as const

export function hasLocalCapability(cap: LocalCapability): boolean {
  return LOCAL_CAPABILITIES.includes(cap)
}

/**
 * Provedor cloud BYOK disponível para o `kind`.
 * Até Fase E nativa: chave OpenRouter = hub cloud.
 * Ollama sozinho não conta como CLOUD (é local).
 */
export async function userHasProvider(kind: CloudKind): Promise<boolean> {
  void kind
  return isOpenRouterConfigured()
}

const NEED_CONNECTION: Record<CloudKind, string> = {
  image:
    'Para gerar imagens, conecte uma IA em Integrações (chave sua). Sem chave do Elio no instalador.',
  codegen:
    'Para montar um site ou app completo, conecte uma IA em Integrações — Claude, ChatGPT, Gemini ou OpenRouter.',
  chat:
    'Para essa conversa mais longa, conecte uma IA em Integrações. Eu continuo ouvindo e agindo no PC sem chave.',
}

export function speakNeedConnection(kind: CloudKind): string {
  return NEED_CONNECTION[kind]
}

export function cloudKindLabel(kind: CloudKind): string {
  switch (kind) {
    case 'image':
      return 'imagem'
    case 'codegen':
      return 'código/site'
    case 'chat':
      return 'conversa'
  }
}
