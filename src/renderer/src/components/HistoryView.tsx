import type { ConversationSummary } from '@shared/ipc'

type Props = {
  summaries: ConversationSummary[]
  activeId: string | null
  onSelect: (id: string) => Promise<void>
  onNew: () => Promise<void>
  onDelete: (id: string) => Promise<void>
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
  onOpenChat,
}: Props): React.JSX.Element {
  return (
    <section className="panel-section history-view">
      <header className="section-header">
        <div>
          <h1>Histórico</h1>
          <p className="section-lede">Conversas salvas neste PC.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => void onNew()}>
          Nova conversa
        </button>
      </header>

      {summaries.length === 0 ? (
        <p className="empty-inline">Nenhuma conversa ainda.</p>
      ) : (
        <ul className="history-list">
          {summaries.map((item) => (
            <li key={item.id} className={item.id === activeId ? 'active' : undefined}>
              <button
                type="button"
                className="history-row"
                onClick={() => {
                  void onSelect(item.id).then(() => onOpenChat())
                }}
              >
                <span className="history-title">{item.title}</span>
                <span className="history-meta">
                  {item.messageCount} msgs · {formatWhen(item.updatedAt)}
                </span>
              </button>
              <button
                type="button"
                className="thread-delete"
                title="Excluir conversa"
                onClick={() => void onDelete(item.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
