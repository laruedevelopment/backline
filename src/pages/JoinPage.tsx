import { Navigate, useParams } from 'react-router-dom'
import { isInviteCode, savePendingInvite } from '../lib/pendingInvite'

/** Entrada del link de invitación: guarda el código y manda a la app. Si la persona no tiene cuenta, la crea y entra sola a la banda. */
export default function JoinPage() {
  const { code = '' } = useParams()
  if (isInviteCode(code)) savePendingInvite(code)
  return <Navigate to="/" replace />
}
