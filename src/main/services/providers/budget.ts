import type { RouteTier } from '../../../shared/aiRoute'

/**
 * Stub de orçamento / cotas (PJ-34).
 * Conta usos em memória; não persiste entre reinícios.
 * Enforcement fica desligado por padrão (ELIO_AI_BUDGET_ENFORCE≠true).
 * Nunca armazena nem registra chaves de API.
 */

export type BudgetBucket = 'byok' | 'free' | 'local'

export type BudgetSnapshot = {
  byokUsed: number
  freeUsed: number
  localUsed: number
  /** null = sem limite configurado (ilimitado no stub). */
  byokLimit: number | null
  freeLimit: number | null
  localLimit: number | null
  /** false no MVP — só contadores + UI; true força soft-block. */
  enforce: boolean
}

const usage: Record<BudgetBucket, number> = {
  byok: 0,
  free: 0,
  local: 0,
}

function parseLimit(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null
  const n = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function env(): NodeJS.ProcessEnv {
  return process.env
}

export function getBudgetSnapshot(): BudgetSnapshot {
  const e = env()
  return {
    byokUsed: usage.byok,
    freeUsed: usage.free,
    localUsed: usage.local,
    byokLimit: parseLimit(e['ELIO_AI_BUDGET_BYOK_DAILY']),
    freeLimit: parseLimit(e['ELIO_AI_BUDGET_FREE_DAILY']),
    localLimit: parseLimit(e['ELIO_AI_BUDGET_LOCAL_DAILY']),
    enforce: e['ELIO_AI_BUDGET_ENFORCE']?.trim().toLowerCase() === 'true',
  }
}

export function tierToBucket(tier: RouteTier): BudgetBucket | null {
  if (tier === 'byok' || tier === 'free' || tier === 'local') return tier
  return null
}

/** Soft-block só quando enforce=true e o limite foi atingido. */
export function isBudgetExhausted(bucket: BudgetBucket): boolean {
  const snap = getBudgetSnapshot()
  if (!snap.enforce) return false
  const limit =
    bucket === 'byok'
      ? snap.byokLimit
      : bucket === 'free'
        ? snap.freeLimit
        : snap.localLimit
  if (limit === null) return false
  return usage[bucket] >= limit
}

export function recordUsage(bucket: BudgetBucket): void {
  usage[bucket] += 1
}

/** Só para testes. */
export function resetBudgetForTests(): void {
  usage.byok = 0
  usage.free = 0
  usage.local = 0
}
