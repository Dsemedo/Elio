import { useCallback, useEffect, useState } from 'react'
import type {
  ChatStatus,
  Conversation,
  ConversationSummary,
} from '@shared/ipc'
import { ChatView } from './components/ChatView'

export default function App(): React.JSX.Element {
  const [status, setStatus] = useState<ChatStatus | null>(null)
  const [summaries, setSummaries] = useState<ConversationSummary[]>([])
  const [active, setActive] = useState<Conversation | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)

  const refreshList = useCallback(async () => {
    const list = await window.elio.listConversations()
    setSummaries(list)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function boot(): Promise<void> {
      if (!window.elio?.getChatStatus) {
        setBootError('Bridge do app indisponível (preload).')
        return
      }
      try {
        const [chatStatus, list] = await Promise.all([
          window.elio.getChatStatus(),
          window.elio.listConversations(),
        ])
        if (cancelled) return
        setStatus(chatStatus)
        setSummaries(list)

        if (list[0]) {
          const first = await window.elio.getConversation(list[0].id)
          if (!cancelled) setActive(first)
        } else {
          const created = await window.elio.createConversation()
          if (!cancelled) {
            setActive(created)
            setSummaries(await window.elio.listConversations())
          }
        }
      } catch (err) {
        if (!cancelled) {
          setBootError(err instanceof Error ? err.message : 'Falha ao iniciar o chat')
        }
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  const selectConversation = async (id: string): Promise<void> => {
    const conversation = await window.elio.getConversation(id)
    setActive(conversation)
  }

  const startNew = async (): Promise<void> => {
    const created = await window.elio.createConversation()
    setActive(created)
    await refreshList()
  }

  const removeConversation = async (id: string): Promise<void> => {
    await window.elio.deleteConversation(id)
    const list = await window.elio.listConversations()
    setSummaries(list)
    if (active?.id === id) {
      if (list[0]) {
        setActive(await window.elio.getConversation(list[0].id))
      } else {
        const created = await window.elio.createConversation()
        setActive(created)
        setSummaries(await window.elio.listConversations())
      }
    }
  }

  if (bootError) {
    return (
      <main className="shell shell-center">
        <section className="hero">
          <h1 className="brand">Elio</h1>
          <p className="lede meta-error">{bootError}</p>
        </section>
      </main>
    )
  }

  if (!active || !status) {
    return (
      <main className="shell shell-center">
        <p className="lede">Carregando o Elio…</p>
      </main>
    )
  }

  return (
    <ChatView
      status={status}
      summaries={summaries}
      conversation={active}
      onConversationChange={async (next) => {
        setActive(next)
        await refreshList()
      }}
      onSelect={selectConversation}
      onNew={startNew}
      onDelete={removeConversation}
      onStatusRefresh={async () => setStatus(await window.elio.getChatStatus())}
    />
  )
}
