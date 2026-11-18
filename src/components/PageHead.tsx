import InfoTip from './InfoTip'

/** Encabezado común de toda pantalla: etiqueta de sección, título y, si hace falta, un botón «i» con la explicación (sin párrafos). */
export default function PageHead({ eyebrow, title, info }: { eyebrow: string; title: string; info?: string }) {
  return (
    <div className="page-head">
      <span className="eyebrow">{eyebrow}</span>
      <div className="title-row">
        <h1 className="page-title">{title}</h1>
        {info && <InfoTip text={info} label={`Qué es ${title}`} />}
      </div>
    </div>
  )
}
