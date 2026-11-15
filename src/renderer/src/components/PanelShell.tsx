import { useCallback, useEffect, useState } from 'react'
import type { ChatStatus, Conversation, ConversationSummary } from '@shared/ipc'
import { ChatView } from './ChatView'
import { ComputerView } from './ComputerView'
import { HistoryView } from './HistoryView'
import { IntegrationsView } from './IntegrationsView'

export type PanelSection = 'conversar' | 'historico' | 'integracoes' | 'computador'

const NAV: { id: PanelSection; label: string }[] = [
  { id: 'conversar', label: 'Conversar' },
  { id: 'historico', label: 'Histórico' },
  { id: 'integracoes', label: 'Integrações' },
  { id: 'computador', label: 'Computador' },
]

export function PanelShell(): React.JSX.Element {
  const [section, setSection] = useState<PanelSection>('conversar')
  const [status, setStatus] = useState<ChatStatus | null>(null)
  const [summaries, setSummaries] = useState<ConversationSummary[]>([])
  const [active, setActive] = useState<Conversation | null>(null)
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)

  const refreshList = useCallback(async () => {
    setSummaries(await window.elio.listConversations())
  }, [])

  useEffect(() => {
    let cancelled = false

    async function boot(): Promise<void> {
      if (!window.elio?.getChatStatus) {
        setBootError('Bridge do app indisponível (preload).')
        return
      }
      try {
        const [chatStatus, list, info] = await Promise.all([
          window.elio.getChatStatus(),
          window.elio.listConversations(),
          window.elio.getAppInfo(),
        ])
        if (cancelled) return
        setStatus(chatStatus)
        setSummaries(list)
        setAppVersion(info.version)

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
          setBootError(err instanceof Error ? err.message : 'Falha ao iniciar o painel')
        }
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  const selectConversation = async (id: string): Promise<void> => {
    setActive(await window.elio.getConversation(id))
  }

  const startNew = async (): Promise<void> => {
    const created = await window.elio.createConversation()
    setActive(created)
    await refreshList()
    setSection('conversar')
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

  if (!active || !status || !appVersion) {
    return (
      <main className="shell shell-center">
        <p className="lede">Carregando o Elio…</p>
      </main>
    )
  }

  return (
    <div className="panel-app">
      <nav className="panel-nav" aria-label="Seções do Elio">
        <div className="panel-nav-brand">
          <span className="sidebar-logo">Elio</span>
          <span className="panel-nav-version">v{appVersion}</span>
        </div>
        <ul>
          {NAV.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={section === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <p className="panel-nav-foot">
          Clique na barrinha para esconder. Se sumir com outro app, use o ícone na
          bandeja.
        </p>
      </nav>

      <div className="panel-body">
        {section === 'conversar' ? (
          <ChatView
            status={status}
            appVersion={appVersion}
            summaries={summaries}
            conversation={active}
            showSidebar={false}
            onConversationChange={async (next) => {
              setActive(next)
              await refreshList()
            }}
            onSelect={selectConversation}
            onNew={startNew}
            onDelete={removeConversation}
            onStatusRefresh={async () => setStatus(await window.elio.getChatStatus())}
          />
        ) : null}

        {section === 'historico' ? (
          <HistoryView
            summaries={summaries}
            activeId={active.id}
            onSelect={selectConversation}
            onNew={startNew}
            onDelete={removeConversation}
            onOpenChat={() => setSection('conversar')}
          />
        ) : null}

        {section === 'integracoes' ? <IntegrationsView status={status} /> : null}

        {section === 'computador' ? <ComputerView /> : null}
      </div>
    </div>
  )
}
