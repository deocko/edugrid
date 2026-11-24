import { useEffect, useRef, type ReactNode } from 'react'
import { Navigate } from 'react-router'
import type { Role } from '../data/types'
import { useStore } from '../state/context'
import { Icon } from './Icon'
import { LinkButton } from './ui'
import { HOME_BY_ROLE } from '../lib/permissions'

export function AccessDenied({ detail }: { detail: string }) {
  const { log, session } = useStore()
  const logged = useRef(false)
  useEffect(() => {
    if (logged.current || !session) return
    logged.current = true
    void log({ action: 'Acceso denegado', detail, kind: 'denegado' })
  }, [detail, log, session])
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <span className="rounded-full bg-danger-bg p-4 text-danger">
        <Icon name="candado" size={28} />
      </span>
      <h1 className="text-xl font-bold text-heading">No tienes acceso a esta información</h1>
      <p className="text-muted">Por seguridad, cada cuenta solo puede ver lo que le corresponde. Este intento quedó registrado en la bitácora.</p>
      {session && <LinkButton to={HOME_BY_ROLE[session.role]}>Volver a mi inicio</LinkButton>}
    </div>
  )
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { session } = useStore()
  if (!session) return <Navigate to="/" replace />
  if (!roles.includes(session.role)) return <AccessDenied detail={`Intentó abrir una sección para: ${roles.join(', ')}`} />
  return <>{children}</>
}
