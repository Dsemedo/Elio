import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'

/**
 * Memórias explícitas locais (JSON em userData).
 * SQLite fica como follow-up — mesmo padrão do chat store.
 */

export const MEMORY_CONTENT_MAX = 500
export const MEMORY_MAX_COUNT = 50
export const MEMORY_TAGS_MAX = 8
export const MEMORY_TAG_MAX_LEN = 32

export const MemorySchema = z.object({
  id: z.string().min(1),
  content: z.string().trim().min(1).max(MEMORY_CONTENT_MAX),
  tags: z.array(z.string().trim().min(1).max(MEMORY_TAG_MAX_LEN)).max(MEMORY_TAGS_MAX),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Memory = z.infer<typeof MemorySchema>

type MemoryStoreFile = {
  memories: Memory[]
}

const CreateMemoryInputSchema = z.object({
  content: z.string().trim().min(1).max(MEMORY_CONTENT_MAX),
  tags: z
    .array(z.string().trim().min(1).max(MEMORY_TAG_MAX_LEN))
    .max(MEMORY_TAGS_MAX)
    .optional(),
})

const UpdateMemoryInputSchema = z.object({
  id: z.string().min(1),
  content: z.string().trim().min(1).max(MEMORY_CONTENT_MAX).optional(),
  tags: z
    .array(z.string().trim().min(1).max(MEMORY_TAG_MAX_LEN))
    .max(MEMORY_TAGS_MAX)
    .optional(),
})

export type CreateMemoryInput = z.infer<typeof CreateMemoryInputSchema>
export type UpdateMemoryInput = z.infer<typeof UpdateMemoryInputSchema>

let overridePath: string | null = null

/** Só para testes — aponta o JSON para um temp dir. */
export function setMemoryStorePathForTests(path: string | null): void {
  overridePath = path
}

function resolveUserData(): string {
  try {
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData')
    }
  } catch {
    /* fora do Electron */
  }
  throw new Error('userData do Electron indisponível para memórias')
}

export function defaultMemoryStorePath(userData?: string): string {
  const root = userData ?? resolveUserData()
  return join(root, 'elio-memories.json')
}

function storePath(): string {
  return overridePath ?? defaultMemoryStorePath()
}

function emptyStore(): MemoryStoreFile {
  return { memories: [] }
}

function readStore(): MemoryStoreFile {
  const path = storePath()
  if (!existsSync(path)) return emptyStore()
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as MemoryStoreFile
    if (!Array.isArray(raw.memories)) return emptyStore()
    const memories: Memory[] = []
    for (const item of raw.memories) {
      const parsed = MemorySchema.safeParse(item)
      if (parsed.success) memories.push(parsed.data)
    }
    return { memories }
  } catch {
    return emptyStore()
  }
}

function writeStore(data: MemoryStoreFile): void {
  const path = storePath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8')
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of tags) {
    const clean = t.trim().toLowerCase()
    if (!clean || seen.has(clean)) continue
    seen.add(clean)
    out.push(clean)
    if (out.length >= MEMORY_TAGS_MAX) break
  }
  return out
}

export function listMemories(): Memory[] {
  return [...readStore().memories].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getMemory(id: string): Memory | null {
  return readStore().memories.find((m) => m.id === id) ?? null
}

export function createMemory(raw: CreateMemoryInput): Memory {
  const input = CreateMemoryInputSchema.parse(raw)
  const data = readStore()
  if (data.memories.length >= MEMORY_MAX_COUNT) {
    throw new Error(`Limite de ${MEMORY_MAX_COUNT} memórias atingido`)
  }
  const stamp = nowIso()
  const memory: Memory = {
    id: randomUUID(),
    content: input.content,
    tags: normalizeTags(input.tags),
    createdAt: stamp,
    updatedAt: stamp,
  }
  data.memories.unshift(memory)
  writeStore(data)
  return memory
}

export function updateMemory(raw: UpdateMemoryInput): Memory {
  const input = UpdateMemoryInputSchema.parse(raw)
  if (input.content === undefined && input.tags === undefined) {
    throw new Error('Nada para atualizar')
  }
  const data = readStore()
  const index = data.memories.findIndex((m) => m.id === input.id)
  if (index < 0) {
    throw new Error('Memória não encontrada')
  }
  const current = data.memories[index]
  if (!current) {
    throw new Error('Memória não encontrada')
  }
  const updated: Memory = {
    ...current,
    content: input.content ?? current.content,
    tags: input.tags !== undefined ? normalizeTags(input.tags) : current.tags,
    updatedAt: nowIso(),
  }
  MemorySchema.parse(updated)
  data.memories[index] = updated
  writeStore(data)
  return updated
}

export function deleteMemory(id: string): boolean {
  const data = readStore()
  const next = data.memories.filter((m) => m.id !== id)
  if (next.length === data.memories.length) return false
  writeStore({ memories: next })
  return true
}

export function clearAllMemories(): number {
  const count = readStore().memories.length
  writeStore(emptyStore())
  return count
}

export function deleteMemoryStoreFile(): void {
  const path = storePath()
  if (!existsSync(path)) return
  try {
    rmSync(path, { force: true })
  } catch {
    /* ignore */
  }
}

export { CreateMemoryInputSchema, UpdateMemoryInputSchema }
