import { useCallback, useEffect, useState } from 'react'
import type { Memory } from '@shared/ipc'

export function MemoryView(): React.JSX.Element {
  const [items, setItems] = useState<Memory[]>([])
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setItems(await window.elio.listMemories())
  }, [])

  useEffect(() => {
    void refresh().catch((err) => {
      setError(err instanceof Error ? err.message : 'Falha ao carregar memórias')
    })
  }, [refresh])

  const add = async (): Promise<void> => {
    const content = draft.trim()
    if (!content) return
    setBusy(true)
    setError(null)
    try {
      await window.elio.createMemory({ content })
      setDraft('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar memória')
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = async (id: string): Promise<void> => {
    const content = editDraft.trim()
    if (!content) return
    setBusy(true)
    setError(null)
    try {
      await window.elio.updateMemory({ id, content })
      setEditingId(null)
      setEditDraft('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string): Promise<void> => {
    if (!window.confirm('Excluir esta memória?')) return
    setBusy(true)
    setError(null)
    try {
      await window.elio.deleteMemory(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel-section memory-view">
      <header className="section-header">
        <div>
          <h1>Memória</h1>
          <p className="section-lede">
            Fatos que o Elio deve lembrar de propósito. Entram no contexto das próximas
            respostas.
          </p>
        </div>
        <span className="badge accent">{items.length}</span>
      </header>

      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}

      <form
        className="memory-compose"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <label className="sr-only" htmlFor="memory-draft">
          Nova memória
        </label>
        <textarea
          id="memory-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ex.: Meu nome é Douglas e moro em Goiânia."
          maxLength={500}
          rows={3}
          disabled={busy}
        />
        <div className="memory-compose-actions">
          <span className="memory-count">{draft.trim().length}/500</span>
          <button type="submit" className="btn primary" disabled={busy || !draft.trim()}>
            Salvar
          </button>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="empty-inline">
          Nenhuma memória ainda. Salve um fato acima para o Elio usar nas conversas.
        </p>
      ) : (
        <ul className="memory-list">
          {items.map((item) => (
            <li key={item.id} className="memory-item">
              {editingId === item.id ? (
                <div className="memory-edit">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    maxLength={500}
                    rows={3}
                    disabled={busy}
                  />
                  <div className="memory-item-actions">
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busy || !editDraft.trim()}
                      onClick={() => void saveEdit(item.id)}
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(null)
                        setEditDraft('')
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="memory-content">{item.content}</p>
                  <div className="memory-item-meta">
                    <time dateTime={item.updatedAt}>
                      {new Date(item.updatedAt).toLocaleString('pt-BR')}
                    </time>
                    <div className="memory-item-actions">
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(item.id)
                          setEditDraft(item.content)
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn ghost danger"
                        disabled={busy}
                        onClick={() => void remove(item.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
