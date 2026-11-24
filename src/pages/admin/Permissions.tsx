import { Card, Notice, PageHeader, Table, TD, TH } from '../../components/ui'
import type { Role } from '../../data/types'
import { ACCESS_LABEL, PERMISSION_MATRIX, ROLE_LABEL, type Access } from '../../lib/permissions'

const ROLES: Role[] = ['admin', 'docente', 'familia', 'alumno']
const TONE: Record<Access, string> = {
  total: 'bg-success-bg text-success',
  grupos: 'bg-info-bg text-info',
  hijos: 'bg-info-bg text-info',
  propio: 'bg-info-bg text-info',
  lectura: 'bg-warning-bg text-warning',
  ninguno: 'bg-surface-2 text-muted',
}

export function Permissions() {
  return (
    <>
      <PageHeader title="Permisos por perfil" subtitle="Quién puede ver qué dentro de EDUGRID." />
      <div className="mb-4">
        <Notice tone="info" icon="escudo">
          Nunca se muestran datos de un menor a quien no le corresponde. Cada consulta se filtra según el perfil y los intentos de acceso no permitidos quedan en la bitácora.
        </Notice>
      </div>
      <ul className="space-y-3 sm:hidden" aria-label="Matriz de permisos">
        {PERMISSION_MATRIX.map((row) => (
          <li key={row.area} className="rounded-2xl border border-line bg-surface p-4">
            <p className="font-semibold text-heading">{row.area}</p>
            <p className="text-xs text-muted">{row.description}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <div key={r} className="min-w-0">
                  <dt className="text-xs text-muted">{ROLE_LABEL[r]}</dt>
                  <dd><span className={`inline-block rounded-lg px-2 py-1 text-xs font-semibold ${TONE[row.access[r]]}`}>{ACCESS_LABEL[row.access[r]]}</span></dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <Card className="hidden sm:block">
        <Table caption="Matriz de permisos">
          <thead>
            <tr>
              <th className={TH}>Área</th>
              {ROLES.map((r) => (
                <th key={r} className={`${TH} text-center`}>{ROLE_LABEL[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MATRIX.map((row) => (
              <tr key={row.area}>
                <td className={TD}>
                  <p className="font-semibold text-heading">{row.area}</p>
                  <p className="text-xs text-muted">{row.description}</p>
                </td>
                {ROLES.map((r) => (
                  <td key={r} className={`${TD} text-center`}>
                    <span className={`inline-block rounded-lg px-2 py-1 text-xs font-semibold ${TONE[row.access[r]]}`}>{ACCESS_LABEL[row.access[r]]}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  )
}
