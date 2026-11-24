import { useState } from 'react'
import { Badge, Card, EmptyState, PageHeader, Table, Tabs, TD, TH, type Tone } from '../../components/ui'
import type { AuditEntry } from '../../data/types'
import { formatDateTime } from '../../lib/format'
import { ROLE_LABEL } from '../../lib/permissions'
import { useApp } from '../../state/context'

const KIND: Record<AuditEntry['kind'], { label: string; tone: Tone }> = {
  acceso: { label: 'Acceso', tone: 'info' },
  cambio: { label: 'Cambio', tone: 'exito' },
  denegado: { label: 'Denegado', tone: 'peligro' },
}

export function AuditLog() {
  const { db } = useApp()
  const [kind, setKind] = useState<'todos' | AuditEntry['kind']>('todos')
  const list = [...db.audit].filter((a) => kind === 'todos' || a.kind === kind).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200)
  return (
    <>
      <PageHeader title="Bitácora" subtitle="Registro de accesos y cambios. Solo la dirección puede consultarlo." />
      <Tabs label="Filtrar bitácora" value={kind} onChange={setKind} options={[{ value: 'todos', label: 'Todo' }, { value: 'acceso', label: 'Accesos' }, { value: 'cambio', label: 'Cambios' }, { value: 'denegado', label: 'Denegados' }]} />
      <Card>
        {list.length === 0 ? (
          <EmptyState icon="bitacora" title="Sin registros">Cuando alguien entre o haga un cambio, aparecerá aquí.</EmptyState>
        ) : (
          <Table caption="Bitácora de accesos y cambios">
            <thead>
              <tr>
                <th className={TH}>Fecha</th>
                <th className={TH}>Quién</th>
                <th className={TH}>Qué hizo</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td className={`${TD} whitespace-nowrap text-muted`}>{formatDateTime(a.at)}</td>
                  <td className={TD}>
                    <p className="font-semibold text-heading">{a.actorName}</p>
                    <p className="text-xs text-muted">{ROLE_LABEL[a.role]}</p>
                  </td>
                  <td className={TD}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={KIND[a.kind].tone}>{KIND[a.kind].label}</Badge>
                      <span className="text-heading">{a.action}</span>
                    </div>
                    {a.detail && <p className="text-xs text-muted">{a.detail}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
