import { describe, expect, it } from 'vitest'
import {
  CAPABILITIES_MANIFEST_VERSION,
  CLOUD_KINDS,
  LOCAL_CAPABILITIES,
  hasLocalCapability,
  speakNeedConnection,
} from '../src/main/services/tools/capabilities'
import { detectCloudEscalate } from '../src/main/services/tools/escalate'

describe('manifesto de capacidades', () => {
  it('versiona e lista capacidades locais', () => {
    expect(CAPABILITIES_MANIFEST_VERSION).toBeGreaterThanOrEqual(1)
    expect(hasLocalCapability('small_talk')).toBe(true)
    expect(hasLocalCapability('pc_action')).toBe(true)
    expect(LOCAL_CAPABILITIES).toContain('small_talk')
    expect(CLOUD_KINDS).toEqual(expect.arrayContaining(['image', 'codegen', 'chat']))
  })

  it('mensagem de conexão sem key do vendedor', () => {
    const msg = speakNeedConnection('image')
    expect(msg.toLowerCase()).toMatch(/conecte/)
    expect(msg.toLowerCase()).not.toMatch(/groq/)
  })
})

describe('detectCloudEscalate', () => {
  it('image', () => {
    expect(detectCloudEscalate('gera uma imagem de um gato')).toBe('image')
    expect(detectCloudEscalate('desenha um robô')).toBe('image')
    expect(detectCloudEscalate('ilustra um pôr do sol')).toBe('image')
  })

  it('codegen', () => {
    expect(detectCloudEscalate('faz um site completo')).toBe('codegen')
    expect(detectCloudEscalate('cria uma landing page')).toBe('codegen')
  })

  it('não escala opens / small talk', () => {
    expect(detectCloudEscalate('abre o Chrome')).toBeNull()
    expect(detectCloudEscalate('oi, tudo bem?')).toBeNull()
  })
})
