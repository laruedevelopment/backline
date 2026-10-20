/** Esqueleto de lista mientras cargan los datos. */
export default function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="list" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-row"><i className="skeleton" style={{ width: `${70 - (i % 3) * 14}%` }} /></div>
      ))}
    </div>
  )
}
