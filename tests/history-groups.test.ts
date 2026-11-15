import { describe, expect, it } from 'vitest'
import {
  filterConversationsByTitle,
  groupConversationsByRecency,
} from '../src/shared/historyGroups'

describe('historyGroups', () => {
  it('filtra por título (case-insensitive)', () => {
    const items = [
      {
        id: '1',
        title: 'Clima em Goiânia',
        updatedAt: '2026-11-15T18:00:00.000Z',
        messageCount: 2,
      },
      {
        id: '2',
        title: 'Spotify play',
        updatedAt: '2026-11-14T18:00:00.000Z',
        messageCount: 1,
      },
    ]
    expect(filterConversationsByTitle(items, 'goiânia')).toHaveLength(1)
    expect(filterConversationsByTitle(items, '  ')).toHaveLength(2)
    expect(filterConversationsByTitle(items, 'xyz')).toHaveLength(0)
  })

  it('agrupa Hoje / Ontem / Anteriores no fuso local', () => {
    const now = new Date(2026, 10, 15, 20, 0, 0) // 15 nov 2026 local
    const isoLocal = (y: number, m: number, d: number): string =>
      new Date(y, m, d, 12, 0, 0).toISOString()

    const items = [
      {
        id: '1',
        title: 'Hoje',
        updatedAt: isoLocal(2026, 10, 15),
        messageCount: 1,
      },
      {
        id: '2',
        title: 'Ontem',
        updatedAt: isoLocal(2026, 10, 14),
        messageCount: 1,
      },
      {
        id: '3',
        title: 'Antes',
        updatedAt: isoLocal(2026, 10, 10),
        messageCount: 0,
      },
    ]

    const groups = groupConversationsByRecency(items, now)
    expect(groups.map((g) => g.id)).toEqual(['hoje', 'ontem', 'anteriores'])
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['1'])
    expect(groups[1]?.items.map((i) => i.id)).toEqual(['2'])
    expect(groups[2]?.items.map((i) => i.id)).toEqual(['3'])
  })
})
