import { useEffect, useRef, useState } from 'react'
import type {
  ChatStatus,
  Conversation,
  ConversationSummary,
} from '@shared/ipc'

type Props = {
  status: ChatStatus
  /** Versão do package.json — se não for v0.2.0+, ainda está no código antigo. */
  appVersion: string
  summaries: ConversationSummary[]
  conversation: Conversation
  onConversationChange: (conversation: Conversation) => Promise<void>
  onSelect: (id: string) => Promise<void>
  onNew: () => Promise<void>
  onDelete: (id: string) => Promise<void>
  onStatusRefresh: () => Promise<void>
}

export function ChatView({
  status,
  appVersion,
  summaries,
  conversation,
  onConversationChange,
  onSelect,
  onNew,
  onDelete,
  onStatusRefresh,
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastModel, setLastModel] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation.messages, busy])

  useEffect(() => {
    inputRef.current?.focus()
  }, [conversation.id])

  const send = async (): Promise<void> => {
    const content = draft.trim()
    if (!content || busy) return

    setBusy(true)
    setError(null)
    setDraft('')

    // Optimistic user bubble via reload after send; show waiting state meanwhile.
    try {
      const result = await window.elio.sendMessage({
        conversationId: conversation.id,
        content,
      })
      setLastModel(`${result.provider} · ${result.model}`)
      await onConversationChange(result.conversation)
      await onStatusRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível responder')
      // Recarrega para refletir a mensagem do usuário já salva (se houver).
      try {
        const fresh = await window.elio.getConversation(conversation.id)
        await onConversationChange(fresh)
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const cancel = async (): Promise<void> => {
    await window.elio.cancelReply(conversation.id)
  }

  const onKeyDown = (event: { key: string; shiftKey: boolean; preventDefault: () => void }): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <div className="chat-app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">Elio</span>
          <button type="button" className="btn ghost" onClick={() => void onNew()}>
            Nova
          </button>
        </div>
        <ul className="thread-list">
          {summaries.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={
                  item.id === conversation.id ? 'thread-item active' : 'thread-item'
                }
                onClick={() => void onSelect(item.id)}
              >
                <span className="thread-title">{item.title}</span>
                <span className="thread-meta">{item.messageCount} msgs</span>
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
      </aside>

      <section className="chat-main">
        <header className="chat-header">
          <div>
            <h1>Conversar</h1>
            <p className="status-hint">{status.hint}</p>
          </div>
          <div className="header-badges">
            <span className="badge" title="Versão do Elio">
              v{appVersion}
            </span>
            {lastModel ? <span className="badge">{lastModel}</span> : null}
            <span className="badge muted">
              {status.preferredProvider === 'none'
                ? 'sem provedor'
                : status.preferredProvider}
            </span>
          </div>
        </header>

        <div className="messages" role="log" aria-live="polite">
          {conversation.messages.length === 0 && !busy ? (
            <div className="empty-state">
              <p className="empty-title">Olá — sou o Elio.</p>
              <p>
                Escreva uma mensagem abaixo. Se o Ollama estiver aberto, respondo
                localmente. Caso contrário, uso OpenRouter se houver chave — ou aviso
                para configurar.
              </p>
            </div>
          ) : null}

          {conversation.messages.map((message) => (
            <article
              key={message.id}
              className={
                message.role === 'user' ? 'bubble bubble-user' : 'bubble bubble-assistant'
              }
            >
              <header className="bubble-meta">
                {message.role === 'user' ? 'Você' : 'Elio'}
                {message.model ? ` · ${message.model}` : ''}
              </header>
              <p className="bubble-body">{message.content}</p>
            </article>
          ))}

          {busy ? (
            <article className="bubble bubble-assistant">
              <header className="bubble-meta">Elio</header>
              <p className="bubble-body thinking">Pensando…</p>
            </article>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : null}

        <footer className="composer">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escreva sua mensagem… (Enter envia, Shift+Enter quebra linha)"
            rows={3}
            disabled={busy}
          />
          <div className="composer-actions">
            {busy ? (
              <button type="button" className="btn ghost" onClick={() => void cancel()}>
                Cancelar
              </button>
            ) : null}
            <button
              type="button"
              className="btn primary"
              disabled={busy || draft.trim().length === 0}
              onClick={() => void send()}
            >
              {busy ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
