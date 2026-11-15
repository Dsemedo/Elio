export type ConversationListItem = {
  id: string
  title: string
  updatedAt: string
  messageCount: number
}

export type HistoryGroupId = 'hoje' | 'ontem' | 'anteriores'

export type HistoryGroup<T extends ConversationListItem = ConversationListItem> = {
  id: HistoryGroupId
  label: string
  items: T[]
}

/** Busca por título (case-insensitive, trim). */
export function filterConversationsByTitle<T extends ConversationListItem>(
  items: T[],
  query: string,
): T[] {
  const q = query.trim().toLocaleLowerCase('pt-BR')
  if (!q) return items
  return items.filter((item) => item.title.toLocaleLowerCase('pt-BR').includes(q))
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Agrupa por Hoje / Ontem / Anteriores (labels só — sem pastas). */
export function groupConversationsByRecency<T extends ConversationListItem>(
  items: T[],
  now: Date = new Date(),
): HistoryGroup<T>[] {
  const today = startOfLocalDay(now)
  const yesterday = today - 24 * 60 * 60 * 1000

  const buckets: Record<HistoryGroupId, T[]> = {
    hoje: [],
    ontem: [],
    anteriores: [],
  }

  for (const item of items) {
    const t = startOfLocalDay(new Date(item.updatedAt))
    if (t >= today) buckets.hoje.push(item)
    else if (t >= yesterday) buckets.ontem.push(item)
    else buckets.anteriores.push(item)
  }

  const groups: HistoryGroup<T>[] = [
    { id: 'hoje', label: 'Hoje', items: buckets.hoje },
    { id: 'ontem', label: 'Ontem', items: buckets.ontem },
    { id: 'anteriores', label: 'Anteriores', items: buckets.anteriores },
  ]

  return groups.filter((g) => g.items.length > 0)
}
