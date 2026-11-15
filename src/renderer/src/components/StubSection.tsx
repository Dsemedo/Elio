type Props = {
  title: string
  lede: string
}

/** Seção honesta “em breve” — curta, sem fingir capacidade. */
export function StubSection({ title, lede }: Props): React.JSX.Element {
  return (
    <section className="panel-section stub-section">
      <header className="section-header">
        <div>
          <h1>{title}</h1>
          <p className="section-lede">{lede}</p>
        </div>
        <span className="badge muted">em breve</span>
      </header>
    </section>
  )
}
