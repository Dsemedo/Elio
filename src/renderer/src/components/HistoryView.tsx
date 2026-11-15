import { useMemo, useState } from 'react'
import type { ConversationSummary } from '@shared/ipc'
import {
  filterConversationsByTitle,
  groupConversationsByRecency,
} from '@shared/historyGroups'

type Props = {
  summaries: ConversationSummary[]
  activeId: string | null
  onSelect: (id: string) => Promise<void>
  onNew: () => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRename: (id: string, title: string) => Promise<void>
  onOpenChat: () => void
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function HistoryView({
  summaries,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onOpenChat,
}: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')

  const filtered = useMemo(
    () => filterConversationsByTitle(summaries, query),
    [summaries, query],
  )
  const groups = useMemo(() => groupConversationsByRecency(filtered), [filtered])

  const beginRename = (item: ConversationSummary): void => {
    setEditingId(item.id)
    setDraftTitle(item.title)
  }

  const commitRename = async (id: string): Promise<void> => {
    const next = draftTitle.trim()
    setEditingId(null)
    if (!next) return
    const current = summaries.find((s) => s.id === id)
    if (current && current.title === next) return
    await onRename(id, next)
  }

  const confirmDelete = async (id: string, title: string): Promise<void> => {
    const ok = window.confirm(`Excluir a conversa “${title}”? Esta ação não pode ser desfeita.`)
    if (!ok) return
    await onDelete(id)
  }

  return (
    <section className="panel-section history-view">
      <header className="section-header">
        <div>
          <h1>Histórico</h1>
          <p className="section-lede">Busque, renomeie ou abra conversas salvas neste PC.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => void onNew()}>
          Nova conversa
        </button>
      </header>

      <label className="history-search">
        <span className="sr-only">Buscar conversas</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título…"
          autoComplete="off"
        />
      </label>

      {filtered.length === 0 ? (
        <p className="empty-inline">
          {summaries.length === 0 ? 'Nenhuma conversa ainda.' : 'Nenhum título corresponde à busca.'}
        </p>
      ) : (
        <div className="history-groups">
          {groups.map((group) => (
            <section key={group.id} className="history-group">
              <h2 className="history-group-label">{group.label}</h2>
              <ul className="history-list">
                {group.items.map((item) => (
                  <li key={item.id} className={item.id === activeId ? 'active' : undefined}>
                    {editingId === item.id ? (
                      <form
                        className="history-rename"
                        onSubmit={(e) => {
                          e.preventDefault()
                          void commitRename(item.id)
                        }}
                      >
                        <input
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onBlur={() => void commitRename(item.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.preventDefault()
                              setEditingId(null)
                            }
                          }}
                          maxLength={80}
                          autoFocus
                          aria-label="Novo título"
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="history-row"
                        onClick={() => {
                          void onSelect(item.id).then(() => onOpenChat())
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault()
                          beginRename(item)
                        }}
                      >
                        <span className="history-title">{item.title}</span>
                        <span className="history-meta">
                          {item.messageCount} msgs · {formatWhen(item.updatedAt)}
                        </span>
                      </button>
                    )}
                    <div className="history-row-actions">
                      <button
                        type="button"
                        className="thread-action"
                        title="Renomear"
                        onClick={() => beginRename(item)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="thread-delete"
                        title="Excluir conversa"
                        onClick={() => void confirmDelete(item.id, item.title)}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
