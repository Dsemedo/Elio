type Props = {
  title: string
  lede: string
  detail: string
}

/** Seção honesta “em breve” — sem fingir capacidade. */
export function StubSection({ title, lede, detail }: Props): React.JSX.Element {
  return (
    <section className="panel-section stub-section">
      <header className="section-header">
        <div>
          <h1>{title}</h1>
          <p className="section-lede">{lede}</p>
        </div>
        <span className="badge muted">em breve</span>
      </header>
      <p className="section-note">{detail}</p>
    </section>
  )
}
