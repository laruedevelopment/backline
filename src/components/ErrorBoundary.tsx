import { Component, type ErrorInfo, type ReactNode } from 'react'
import { CHUNK, reloadForNewVersion } from '../lib/reload'
type Props = { children: ReactNode; compact?: boolean }
type State = { error: Error | null }

/**
 * Evita la pantalla en blanco: si una pantalla falla al cargarse (lo más común es que se publicó una versión nueva mientras la app
 * estaba abierta y el archivo de la versión vieja ya no existe) se recarga sola, y si no, se ofrece un botón para reintentar.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de pantalla', error, info.componentStack)
    if (CHUNK.test(String(error?.message ?? error))) reloadForNewVersion()
  }

  render() {
    if (!this.state.error) return this.props.children
    const stale = CHUNK.test(String(this.state.error?.message ?? ''))
    return (
      <div className={this.props.compact ? 'empty' : 'fullscreen-msg'} role="alert">
        <h3>{stale ? 'Hay una versión nueva' : 'Algo salió mal en esta pantalla'}</h3>
        <p>{stale ? 'Actualizamos Backline mientras la tenías abierta. Recarga para seguir.' : 'No se perdió nada de lo guardado. Recarga para intentar de nuevo.'}</p>
        <button className="btn primary" onClick={() => window.location.reload()}>Recargar</button>
      </div>
    )
  }
}
