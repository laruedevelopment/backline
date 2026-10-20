import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { privacy, terms } from '../content/legal'

/** Páginas públicas (sin iniciar sesión): /privacidad y /terminos. */
export default function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  const d = doc === 'privacy' ? privacy : terms
  return (
    <div className="main" style={{ paddingTop: 16 }}>
      <Link to="/" className="back"><ArrowLeft size={18} aria-hidden /> Volver a Backline</Link>
      <div className="page-head">
        <span className="eyebrow">Legal</span>
        <h1 className="page-title" style={{ fontSize: 'clamp(1.8rem, 7vw, 2.6rem)' }}>{d.title}</h1>
        {d.intro && <p className="page-sub">{d.intro}</p>}
      </div>
      <p className="notice">Este texto es un borrador en revisión y puede cambiar antes de abrir Backline al público.</p>
      <article className="legal">
        {d.sections.map((s) => (
          <section key={s.title}>
            <h2>{s.title}</h2>
            {s.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
            {s.bullets && <ul>{s.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
          </section>
        ))}
      </article>
      <p className="li-sub wrap" style={{ marginTop: 28 }}>
        <Link to="/privacidad" style={{ color: 'var(--amber)' }}>Privacidad</Link> · <Link to="/terminos" style={{ color: 'var(--amber)' }}>Términos</Link>
      </p>
    </div>
  )
}
