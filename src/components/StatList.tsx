import type { ReactNode } from 'react'
import { Link } from 'react-router'

/** Listado sencillo que abre un indicador del tablero: cada fila puede llevar a su detalle. */
export function StatList({ rows, empty = 'No hay registros.' }: { rows: { key: string; label: ReactNode; value?: ReactNode; to?: string }[]; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.key}>
          {r.to ? (
            <Link to={r.to} className="-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm no-underline hover:bg-surface-2">
              <span className="font-semibold text-link">{r.label}</span>
              {r.value !== undefined && <span className="text-right tabular-nums text-muted">{r.value}</span>}
            </Link>
          ) : (
            <div className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
              <span className="font-semibold text-heading">{r.label}</span>
              {r.value !== undefined && <span className="text-right tabular-nums text-muted">{r.value}</span>}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
