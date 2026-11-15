/** Snapshot de cotas/orçamento (stub PJ-34) — espelha o main sem secrets. */
export type BudgetSnapshot = {
  byokUsed: number
  freeUsed: number
  localUsed: number
  byokLimit: number | null
  freeLimit: number | null
  localLimit: number | null
  enforce: boolean
}
