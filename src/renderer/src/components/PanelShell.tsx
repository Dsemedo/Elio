import { useCallback, useEffect, useState } from 'react'
import { Activity, Bot, Brain, Home, MessageSquare, Settings } from 'lucide-react'
import type { ChatStatus, Conversation, ConversationSummary } from '@shared/ipc'
import { ChatView } from './ChatView'
import { ComputerView } from './ComputerView'
import { HistoryView } from './HistoryView'
import { HomeView } from './HomeView'
import { IntegrationsView } from './IntegrationsView'
import { StubSection } from './StubSection'

export type PanelSection =
  | 'inicio'
  | 'conversas'
  | 'historico'
  | 'atividades'
  | 'agentes'
  | 'memoria'
  | 'configuracoes'

const NAV: {
  id: PanelSection
  label: string
  icon: typeof Home
  stub?: boolean
}[] = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'conversas', label: 'Conversas', icon: MessageSquare },
  { id: 'atividades', label: 'Atividades', icon: Activity, stub: true },
  { id: 'agentes', label: 'Agentes', icon: Bot, stub: true },
  { id: 'memoria', label: 'Memória', icon: Brain, stub: true },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
]

export function PanelShell(): React.JSX.Element {
  const [section, setSection] = useState<PanelSection>('inicio')
  const [convTab, setConvTab] = useState<'chat' | 'historico'>('chat')
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
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={section === item.id ? 'nav-item active' : 'nav-item'}
                  onClick={() => setSection(item.id)}
                >
                  <Icon size={16} aria-hidden />
                  <span>{item.label}</span>
                  {item.stub ? <span className="nav-soon">em breve</span> : null}
                </button>
              </li>
            )
          })}
        </ul>
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
            onOpenConversas={() => {
              setSection('conversas')
              setConvTab('chat')
            }}
            onOpenConfig={() => setSection('configuracoes')}
          />
        ) : null}

        {section === 'conversas' ? (
          <div className="conversas-wrap">
            <div className="conv-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={convTab === 'chat'}
                className={convTab === 'chat' ? 'conv-tab active' : 'conv-tab'}
                onClick={() => setConvTab('chat')}
              >
                Chat
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={convTab === 'historico'}
                className={convTab === 'historico' ? 'conv-tab active' : 'conv-tab'}
                onClick={() => setConvTab('historico')}
              >
                Histórico
              </button>
            </div>
            {convTab === 'chat' ? (
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
            ) : (
              <HistoryView
                summaries={summaries}
                activeId={active.id}
                onSelect={selectConversation}
                onNew={startNew}
                onDelete={removeConversation}
                onOpenChat={() => setConvTab('chat')}
              />
            )}
          </div>
        ) : null}

        {section === 'atividades' ? (
          <StubSection
            title="Atividades"
            lede="Acompanhar o que o Elio está fazendo."
            detail="Ainda não há trilha de tarefas no núcleo. Esta seção será preenchida quando o assistente passar a executar e registrar ações."
          />
        ) : null}

        {section === 'agentes' ? (
          <StubSection
            title="Agentes"
            lede="Workspace de agentes especializados."
            detail="Fora da Fase 1. Em breve: criar e gerenciar agentes sem reescrever o chat atual."
          />
        ) : null}

        {section === 'memoria' ? (
          <StubSection
            title="Memória"
            lede="O que o Elio deve lembrar de propósito."
            detail="Memória explícita ainda não está no MVP. O histórico de conversas já fica em Conversas."
          />
        ) : null}

        {section === 'configuracoes' ? (
          <div className="config-stack">
            <IntegrationsView status={status} />
            <ComputerView />
          </div>
        ) : null}
      </div>
    </div>
  )
}
