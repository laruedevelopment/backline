import fs from 'node:fs'
const CR = String.fromCharCode(13), LF = String.fromCharCode(10)
const p = 'src/pages/LegalPage.tsx'
let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes(CR); s = s.split(CR).join('')
const pairs = [
  ["      <article className=\"legal\">\n        {d.sections.map((s) => (\n          <section key={s.title}>", "      {d.sections.length > 4 && (\n        <nav className=\"card legal-toc\" aria-label=\"Contenido\">\n          <div className=\"eyebrow\" style={{ marginBottom: 6 }}>Contenido</div>\n          <ol>\n            {d.sections.map((s, i) => (\n              <li key={s.title}><button type=\"button\" className=\"link-btn\" onClick={() => document.getElementById(`sec-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{s.title}</button></li>\n            ))}\n          </ol>\n        </nav>\n      )}\n      <article className=\"legal\">\n        {d.sections.map((s, i) => (\n          <section key={s.title} id={`sec-${i}`} style={{ scrollMarginTop: 16 }}>"],
]
for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error('ancla'); s = s.replace(a, () => b) }
fs.writeFileSync(p, crlf ? s.split(LF).join(CR + LF) : s)
