import fs from 'node:fs'
const CR = String.fromCharCode(13), LF = String.fromCharCode(10)
const p = 'src/pages/business/PaymentSettings.tsx'
let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes(CR); s = s.split(CR).join('')
const pairs = [
  ['<label className="field grow">Anticipo', '<label className="field grow">Cobro por adelantado'],
  ['<option value="">Pago total por adelantado</option>', '<option value="">Pago total</option>'],
  ['<option value="30">30 % (el resto en la sala)</option>', '<option value="30">Anticipo 30 %</option>'],
  ['<option value="50">50 % (el resto en la sala)</option>', '<option value="50">Anticipo 50 %</option>'],
  ['<label className="field grow">Esperar el pago hasta', '<label className="field grow">Plazo para pagar'],
]
for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(a); s = s.replace(a, () => b) }
s = s.replace("{HOLDS.map((h) => <option key={h} value={h}>{h} horas</option>)}\n            </select>\n          </label>\n        </div>", "{HOLDS.map((h) => <option key={h} value={h}>{h} horas</option>)}\n            </select>\n          </label>\n        </div>\n        <p className=\"li-sub wrap\">{f.depositPct ? `El cliente paga el ${f.depositPct} % al reservar y el resto en la sala.` : 'El cliente paga todo al reservar.'} Si no adjunta el comprobante en {f.holdHours} horas, la reserva se cancela sola.</p>")
fs.writeFileSync(p, crlf ? s.split(LF).join(CR + LF) : s)
