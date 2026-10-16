import { StatusBadge } from '../components/StatusBadge'

const colorTokens = [
  { name: 'Page background', token: '--color-background' },
  { name: 'Card surface', token: '--color-surface' },
  { name: 'Elevated surface', token: '--color-surface-elevated' },
  { name: 'Brand', token: '--color-accent' },
  { name: 'Primary text', token: '--color-text-primary' },
  { name: 'Secondary text', token: '--color-text-secondary' },
  { name: 'Border', token: '--color-border' },
  { name: 'Success', token: '--color-success' },
  { name: 'Warning', token: '--color-warning' },
  { name: 'Danger', token: '--color-danger' },
  { name: 'Information', token: '--color-information' },
]

export function StyleGuidePage() {
  return (
    <div className="style-guide-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">WASALNI UI FOUNDATIONS</span>
          <h1>Design system</h1>
          <p>Shared color, type, spacing, and component foundations used across the application.</p>
        </div>
      </header>

      <section aria-labelledby="guide-colors-title">
        <header className="section-heading"><div><span className="eyebrow">THEME TOKENS</span><h2 id="guide-colors-title">Color palette</h2></div></header>
        <div className="style-guide-swatches">
          {colorTokens.map(({ name, token }) => (
            <article className="style-guide-swatch" key={token}>
              <strong>{name}</strong>
              <span className="style-guide-color" style={{ backgroundColor: `var(${token})` }} aria-hidden="true" />
              <code>{token}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="style-guide-example" aria-labelledby="guide-components-title">
        <header className="section-heading"><div><span className="eyebrow">REUSABLE PATTERNS</span><h2 id="guide-components-title">Component examples</h2></div></header>
        <div className="style-guide-controls">
          <button className="btn btn-primary" type="button">Primary action</button>
          <button className="btn btn-light" type="button">Secondary action</button>
          <StatusBadge status="scheduled" kind="trip" />
          <StatusBadge status="completed" kind="trip" />
          <StatusBadge status="delayed" kind="trip" />
          <StatusBadge status="cancelled" kind="trip" />
        </div>
        <div className="style-guide-seat-examples" aria-label="Seat availability examples">
          <span className="vehicle-seat">01</span>
          <span className="vehicle-seat seat-selected"><i className="bi bi-check-lg" aria-hidden="true" />02</span>
          <span className="vehicle-seat seat-booked"><i className="bi bi-lock-fill" aria-hidden="true" />03</span>
          <span className="style-guide-caption">Available · Selected · Booked</span>
        </div>
      </section>
    </div>
  )
}
