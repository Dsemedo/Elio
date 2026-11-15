import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MEMORY_CONTENT_MAX,
  MEMORY_MAX_COUNT,
  clearAllMemories,
  createMemory,
  deleteMemory,
  listMemories,
  setMemoryStorePathForTests,
  updateMemory,
} from '../src/main/services/memory/store'
import {
  MEMORY_PROMPT_BUDGET,
  formatMemoriesForPrompt,
} from '../src/main/services/memory/prompt'
import { enrichMessagesWithLocalFacts } from '../src/main/services/tools/enrich'

describe('memory store CRUD', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'elio-mem-'))
    setMemoryStorePathForTests(join(dir, 'elio-memories.json'))
  })

  afterEach(async () => {
    setMemoryStorePathForTests(null)
    await rm(dir, { recursive: true, force: true })
  })

  it('cria, lista, atualiza e apaga', () => {
    const created = createMemory({ content: 'Moro em Goiânia', tags: ['casa'] })
    expect(created.content).toBe('Moro em Goiânia')
    expect(created.tags).toEqual(['casa'])
    expect(listMemories()).toHaveLength(1)

    const updated = updateMemory({ id: created.id, content: 'Moro em Goiânia-GO' })
    expect(updated.content).toContain('Goiânia-GO')
    expect(listMemories()[0]?.content).toContain('Goiânia-GO')

    expect(deleteMemory(created.id)).toBe(true)
    expect(listMemories()).toHaveLength(0)
  })

  it('rejeita conteúdo vazio e respeita limite', () => {
    expect(() => createMemory({ content: '   ' })).toThrow()
    expect(() => createMemory({ content: 'x'.repeat(MEMORY_CONTENT_MAX + 1) })).toThrow()

    for (let i = 0; i < MEMORY_MAX_COUNT; i += 1) {
      createMemory({ content: `fato ${i}` })
    }
    expect(() => createMemory({ content: 'extra' })).toThrow(/Limite/)
    expect(clearAllMemories()).toBe(MEMORY_MAX_COUNT)
  })

  it('formata bloco de prompt e respeita orçamento', () => {
    const memories = [
      createMemory({ content: 'Nome: Douglas' }),
      createMemory({ content: 'Cidade: Goiânia' }),
    ]
    const block = formatMemoriesForPrompt(listMemories())
    expect(block).toMatch(/Memórias explícitas/)
    expect(block).toMatch(/Douglas/)
    expect(block).toMatch(/Goiânia/)

    const tight = formatMemoriesForPrompt(memories, 80)
    expect(tight).toMatch(/omitidas|Memórias/)
    expect((tight ?? '').length).toBeLessThanOrEqual(MEMORY_PROMPT_BUDGET)
  })

  it('injeta memórias no enrich do system prompt', async () => {
    createMemory({ content: 'Prefiro respostas curtas' })
    const enriched = await enrichMessagesWithLocalFacts([
      { role: 'user', content: 'olá' },
    ])
    expect(enriched[0]?.role).toBe('system')
    expect(enriched[0]?.content).toMatch(/Prefiro respostas curtas/)
    expect(enriched[0]?.content).toMatch(/Memórias explícitas/)
  })
})
