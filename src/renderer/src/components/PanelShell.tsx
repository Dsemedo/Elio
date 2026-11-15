import { useCallback, useEffect, useRef, useState } from 'react'
import { Brain, Home, MessageSquare, Settings } from 'lucide-react'
import type { ChatStatus, Conversation, ConversationSummary } from '@shared/ipc'
import { ChatView } from './ChatView'
import { ComputerView } from './ComputerView'
import { HistoryView } from './HistoryView'
import { HomeView } from './HomeView'
import { DataSettingsView } from './DataSettingsView'
import { IntegrationsView } from './IntegrationsView'
import { MemoryView } from './MemoryView'
import { StubSection } from './StubSection'

export type PanelSection =
  | 'inicio'
  | 'conversas'
  | 'historico'
  | 'atividades'
  | 'agentes'
  | 'memoria'
  | 'configuracoes'

const PRIMARY_NAV: {
  id: PanelSection
  label: string
  icon: typeof Home
}[] = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'conversas', label: 'Conversas', icon: MessageSquare },
  { id: 'memoria', label: 'Memória', icon: Brain },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
]

const SOON_NAV: { id: PanelSection; label: string }[] = [
  { id: 'atividades', label: 'Atividades' },
  { id: 'agentes', label: 'Agentes' },
]

export function PanelShell(): React.JSX.Element {
  const [section, setSection] = useState<PanelSection>('inicio')
  const [convTab, setConvTab] = useState<'chat' | 'historico'>('chat')
  const [configTab, setConfigTab] = useState<'integracoes' | 'computador' | 'dados'>('integracoes')
  const [status, setStatus] = useState<ChatStatus | null>(null)
  const [summaries, setSummaries] = useState<ConversationSummary[]>([])
  const [active, setActive] = useState<Conversation | null>(null)
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const activeIdRef = useRef<string | null>(null)

  const refreshList = useCallback(async () => {
    setSummaries(await window.elio.listConversations())
  }, [])

  const refreshStatus = useCallback(async () => {
    setStatus(await window.elio.getChatStatus())
  }, [])

  useEffect(() => {
    activeIdRef.current = active?.id ?? null
  }, [active?.id])

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

    const unsub = window.elio.onChatUpdated((event) => {
      void (async () => {
        try {
          const list = await window.elio.listConversations()
          if (cancelled) return
          setSummaries(list)
          const currentId = activeIdRef.current

          if (event.reason === 'deleted') {
            if (currentId === event.conversationId || !currentId) {
              if (list[0]) {
                const next = await window.elio.getConversation(list[0].id)
                if (!cancelled) setActive(next)
              } else {
                const created = await window.elio.createConversation()
                if (!cancelled) {
                  setActive(created)
                  setSummaries(await window.elio.listConversations())
                }
              }
            }
            return
          }

          if (event.conversation) {
            if (!currentId || currentId === event.conversationId) {
              setActive(event.conversation)
            }
            return
          }

          if (currentId === event.conversationId) {
            const fresh = await window.elio.getConversation(event.conversationId)
            if (!cancelled) setActive(fresh)
          }
        } catch {
          /* ignore sync transitório */
        }
      })()
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const selectConversation = async (id: string): Promise<void> => {
    setActive(await window.elio.getConversation(id))
  }

  const startNew = async (): Promise<void> => {
    const created = await window.elio.createConversation()
    setActive(created)
    await refreshList()
    setSection('conversas')
    setConvTab('chat')
  }

  const continueLast = (): void => {
    setSection('conversas')
    setConvTab('chat')
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

  const renameConversation = async (id: string, title: string): Promise<void> => {
    const updated = await window.elio.renameConversation({ conversationId: id, title })
    if (active?.id === id) setActive(updated)
    await refreshList()
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
      <nav className="panel-nav" aria-label="Command Center">
        <div className="panel-nav-brand">
          <span className="sidebar-logo">Elio</span>
          <span className="panel-nav-version">v{appVersion}</span>
        </div>
        <ul>
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon
            const activeNav =
              item.id === 'conversas'
                ? section === 'conversas' || section === 'historico'
                : section === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={activeNav ? 'nav-item active' : 'nav-item'}
                  onClick={() => {
                    setSection(item.id)
                    if (item.id === 'conversas') setConvTab('chat')
                  }}
                >
                  <Icon size={16} aria-hidden />
                  <span>{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="panel-nav-soon">
          <p className="panel-nav-soon-label">Em breve</p>
          <ul>
            {SOON_NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={
                    section === item.id ? 'nav-item soon active' : 'nav-item soon'
                  }
                  onClick={() => setSection(item.id)}
                >
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <p className="panel-nav-foot">
          Floating Bar no topo. Se sumir, use o ícone na bandeja.
        </p>
      </nav>

      <div className="panel-body">
        {section === 'inicio' ? (
          <HomeView
            status={status}
            appVersion={appVersion}
            summaries={summaries}
            activeTitle={active.title}
            onContinue={continueLast}
            onNew={() => void startNew()}
            onOpenConfig={() => setSection('configuracoes')}
          />
        ) : null}

        {section === 'conversas' || section === 'historico' ? (
          <div className="conversas-wrap">
            <div className="conv-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={convTab === 'chat'}
                className={convTab === 'chat' ? 'conv-tab active' : 'conv-tab'}
                onClick={() => {
                  setSection('conversas')
                  setConvTab('chat')
                }}
              >
                Chat
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={convTab === 'historico'}
                className={convTab === 'historico' ? 'conv-tab active' : 'conv-tab'}
                onClick={() => {
                  setSection('conversas')
                  setConvTab('historico')
                }}
              >
                Histórico
              </button>
            </div>
            {convTab === 'chat' ? (
              <ChatView
                status={status}
                summaries={summaries}
                conversation={active}
                showSidebar
                onConversationChange={async (next) => {
                  setActive(next)
                  await refreshList()
                }}
                onSelect={selectConversation}
                onNew={startNew}
                onDelete={removeConversation}
                onRename={renameConversation}
                onStatusRefresh={async () => setStatus(await window.elio.getChatStatus())}
              />
            ) : (
              <HistoryView
                summaries={summaries}
                activeId={active.id}
                onSelect={selectConversation}
                onNew={startNew}
                onDelete={removeConversation}
                onRename={renameConversation}
                onOpenChat={() => setConvTab('chat')}
              />
            )}
          </div>
        ) : null}

        {section === 'atividades' ? (
          <StubSection title="Atividades" lede="Trilha de tarefas — em breve." />
        ) : null}

        {section === 'agentes' ? (
          <StubSection title="Agentes" lede="Workspace de agentes — em breve." />
        ) : null}

        {section === 'memoria' ? <MemoryView /> : null}

        {section === 'configuracoes' ? (
          <div className="config-stack">
            <div className="conv-tabs config-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={configTab === 'integracoes'}
                className={
                  configTab === 'integracoes' ? 'conv-tab active' : 'conv-tab'
                }
                onClick={() => setConfigTab('integracoes')}
              >
                Integrações
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={configTab === 'computador'}
                className={
                  configTab === 'computador' ? 'conv-tab active' : 'conv-tab'
                }
                onClick={() => setConfigTab('computador')}
              >
                Computador
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={configTab === 'dados'}
                className={configTab === 'dados' ? 'conv-tab active' : 'conv-tab'}
                onClick={() => setConfigTab('dados')}
              >
                Dados
              </button>
            </div>
            {configTab === 'integracoes' ? (
              <IntegrationsView status={status} onStatusRefresh={refreshStatus} />
            ) : null}
            {configTab === 'computador' ? <ComputerView /> : null}
            {configTab === 'dados' ? (
              <DataSettingsView
                onAfterDeleteAll={async () => {
                  await refreshStatus()
                  const list = await window.elio.listConversations()
                  setSummaries(list)
                  if (list[0]) {
                    setActive(await window.elio.getConversation(list[0].id))
                  } else {
                    const created = await window.elio.createConversation()
                    setActive(created)
                    setSummaries(await window.elio.listConversations())
                  }
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
