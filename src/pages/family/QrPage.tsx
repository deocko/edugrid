import { useState } from 'react'
import { QrCode } from '../../components/QrCode'
import { Avatar, Badge, Card, EmptyState, Notice, PageHeader, Tabs } from '../../components/ui'
import { checkinsOfDay, presenceOf } from '../../lib/presence'
import { formatQrCode, qrPayload } from '../../lib/qr'
import { groupLabel, studentName, visibleStudents } from '../../lib/scope'
import { useApp } from '../../state/context'

/** Credencial QR para que la familia (o el alumno) la muestre en la entrada. */
export function QrPage() {
  const { db, session } = useApp()
  const kids = visibleStudents(db, session)
  const [who, setWho] = useState(kids[0]?.id ?? '')
  const st = kids.find((k) => k.id === who) ?? kids[0]
  if (!st) return <EmptyState icon="hijo" title="No hay alumnos vinculados a tu cuenta" />
  const today = checkinsOfDay(db, st.id)
  const state = presenceOf(db, st.id)
  const mine = session.role === 'alumno'

  return (
    <>
      <PageHeader title={mine ? 'Mi credencial QR' : 'Credencial QR'} subtitle="Muéstrala en la entrada: la primera lectura del día registra la entrada y la siguiente, la salida." />
      {kids.length > 1 && <Tabs label="Credencial de" value={st.id} onChange={setWho} options={kids.map((k) => ({ value: k.id, label: k.firstName }))} />}
      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center text-center">
          <Avatar name={studentName(st)} src={st.photo} size={72} />
          <p className="mt-2 text-lg font-bold text-heading">{studentName(st)}</p>
          <p className="mb-4 text-sm text-muted">{groupLabel(db, st.groupId)}</p>
          <div className="rounded-2xl bg-white p-3">
            <QrCode value={qrPayload(st.qrCode)} size={232} label={`Código QR de ${studentName(st)}`} />
          </div>
          <p className="mt-3 text-sm text-muted">Si la cámara no lo lee, dicta este código:</p>
          <p className="font-mono text-2xl font-bold tracking-widest text-heading">{formatQrCode(st.qrCode)}</p>
        </Card>
        <div className="space-y-4">
          <Card title="Hoy">
            <p className="mb-3">
              {state === 'dentro' && <Badge tone="exito">Está en la escuela</Badge>}
              {state === 'salio' && <Badge tone="info">Ya salió</Badge>}
              {state === 'sin-registro' && <Badge>Aún sin registro</Badge>}
            </p>
            {today.length === 0 ? (
              <p className="text-sm text-muted">Cuando escaneen la credencial, aquí verás la hora de entrada y de salida.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {today.map((c) => <li key={c.id}><strong className="tabular-nums">{c.at.slice(11, 16)}</strong> · {c.type === 'entrada' ? 'Entrada' : 'Salida'} · {c.place}</li>)}
              </ul>
            )}
          </Card>
          <Notice tone="info" icon="candado">El QR no lleva el nombre ni datos de tu hija o hijo: solo un código que la escuela reconoce. Si lo pierdes o lo comparte alguien más, pide a la dirección uno nuevo.</Notice>
        </div>
      </div>
    </>
  )
}
