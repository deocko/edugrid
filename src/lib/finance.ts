import type { Charge, Database, Payment } from '../data/types'
import { todayISO } from './format'

export const paidFor = (db: Database, chargeId: string) =>
  db.payments.filter((p) => p.chargeId === chargeId).reduce((sum, p) => sum + p.amount, 0)

export type ChargeStatus = 'pagado' | 'parcial' | 'vencido' | 'pendiente'

export interface ChargeView extends Charge {
  paid: number
  balance: number
  status: ChargeStatus
  payments: Payment[]
}

export const chargeView = (db: Database, c: Charge, today = todayISO()): ChargeView => {
  const payments = db.payments.filter((p) => p.chargeId === c.id)
  const paid = payments.reduce((s, p) => s + p.amount, 0)
  const balance = Math.max(0, Math.round((c.amount - paid) * 100) / 100)
  let status: ChargeStatus = 'pendiente'
  if (balance === 0) status = 'pagado'
  else if (c.dueDate < today) status = 'vencido'
  else if (paid > 0) status = 'parcial'
  return { ...c, paid, balance, status, payments }
}

export const studentCharges = (db: Database, studentId: string) =>
  db.charges
    .filter((c) => c.studentId === studentId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((c) => chargeView(db, c))

export const studentBalance = (db: Database, studentId: string) => {
  const list = studentCharges(db, studentId)
  return {
    total: list.reduce((s, c) => s + c.amount, 0),
    paid: list.reduce((s, c) => s + c.paid, 0),
    balance: list.reduce((s, c) => s + c.balance, 0),
    overdue: list.filter((c) => c.status === 'vencido').reduce((s, c) => s + c.balance, 0),
  }
}

export const STATUS_LABEL: Record<ChargeStatus, string> = {
  pagado: 'Pagado',
  parcial: 'Pago parcial',
  vencido: 'Vencido',
  pendiente: 'Por vencer',
}

export const METHOD_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta' } as const
