import type { Diagram } from '../../lib/learn'

const W = 300

function Fretboard({ d }: { d: Extract<Diagram, { kind: 'fretboard' }> }) {
  const left = 34, top = 22, gx = (W - left - 10) / d.frets, gy = d.strings === 6 ? 24 : 30
  const h = gy * (d.strings - 1)
  const y = (s: number) => top + (s - 1) * gy // cuerda 1 arriba
  const x = (f: number) => left + (f - 0.5) * gx
  return (
    <svg viewBox={`0 0 ${W} ${top + h + 26}`} role="img" aria-label="Diagrama del diapasón" className="diagram">
      {Array.from({ length: d.frets + 1 }, (_, f) => (
        <line key={f} x1={left + f * gx} x2={left + f * gx} y1={top} y2={top + h} stroke="var(--line)" strokeWidth={f === 0 ? 4 : 1.5} />
      ))}
      {Array.from({ length: d.strings }, (_, i) => (
        <line key={i} x1={left} x2={left + d.frets * gx} y1={y(i + 1)} y2={y(i + 1)} stroke="var(--muted)" strokeWidth={1 + i * 0.25} />
      ))}
      {Array.from({ length: d.frets }, (_, i) => (
        <text key={i} x={x(i + 1)} y={top + h + 18} textAnchor="middle" fontSize="10" fill="var(--muted)">{i + 1}</text>
      ))}
      {d.dots.map((p, i) => {
        const cx = p.fret === 0 ? left - 14 : x(p.fret)
        return (
          <g key={i}>
            <circle cx={cx} cy={y(p.string)} r={9} fill={p.label === 'R' ? 'var(--ember)' : 'var(--amber)'} />
            {p.label && <text x={cx} y={y(p.string) + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--amber-ink)">{p.label}</text>}
          </g>
        )
      })}
    </svg>
  )
}

function Drums({ d }: { d: Extract<Diagram, { kind: 'drums' }> }) {
  const left = 58, cell = (W - left - 6) / d.steps, rowH = 26
  return (
    <svg viewBox={`0 0 ${W} ${d.rows.length * rowH + 24}`} role="img" aria-label="Patrón de batería" className="diagram">
      {Array.from({ length: d.steps }, (_, s) => (
        <text key={s} x={left + s * cell + cell / 2} y={12} textAnchor="middle" fontSize="10" fill="var(--muted)">
          {s % 2 === 0 ? s / 2 + 1 : 'y'}
        </text>
      ))}
      {d.rows.map((r, ri) => (
        <g key={r.name}>
          <text x={0} y={24 + ri * rowH + 14} fontSize="11" fill="var(--text)">{r.name}</text>
          {Array.from({ length: d.steps }, (_, s) => (
            <rect key={s} x={left + s * cell + 2} y={24 + ri * rowH + 2} width={cell - 4} height={rowH - 6} rx={5}
              fill={r.hits.includes(s) ? 'var(--amber)' : 'var(--surface-2)'} />
          ))}
        </g>
      ))}
    </svg>
  )
}

const WHITE = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const BLACK: [string, number][] = [['C#', 1], ['D#', 2], ['F#', 4], ['G#', 5], ['A#', 6]]

function Keys({ d }: { d: Extract<Diagram, { kind: 'keys' }> }) {
  const n = 7 * d.octaves + 1, kw = (W - 4) / n
  return (
    <svg viewBox={`0 0 ${W} 110`} role="img" aria-label="Teclado de piano" className="diagram">
      {Array.from({ length: n }, (_, i) => {
        const note = WHITE[i % 7]
        const on = d.highlight.includes(note)
        return (
          <g key={i}>
            <rect x={2 + i * kw} y={4} width={kw - 1.5} height={100} rx={3} fill={on ? 'var(--amber)' : 'var(--text)'} />
            <text x={2 + i * kw + kw / 2} y={96} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--amber-ink)">{note}</text>
          </g>
        )
      })}
      {Array.from({ length: d.octaves }, (_, o) =>
        BLACK.map(([note, pos]) => (
          <rect key={`${o}${note}`} x={2 + (o * 7 + pos) * kw - kw * 0.3} y={4} width={kw * 0.6} height={62} rx={2}
            fill={d.highlight.includes(note) ? 'var(--ember)' : 'var(--ink)'} />
        )),
      )}
    </svg>
  )
}

export default function DiagramView({ diagram }: { diagram: Diagram }) {
  return diagram.kind === 'fretboard' ? <Fretboard d={diagram} /> : diagram.kind === 'drums' ? <Drums d={diagram} /> : <Keys d={diagram} />
}
