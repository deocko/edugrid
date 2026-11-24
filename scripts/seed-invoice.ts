// Agrega a la semilla UNA factura demo ya emitida (XML timbrado por el PAC de demostración).
// Uso (desde la raíz): npm run seed
import { readFileSync, writeFileSync } from 'node:fs'
import { emitInvoice } from '../src/cfdi/service'
import type { Database } from '../src/data/types'

const path = 'src/data/seed.json' // se ejecuta desde la raíz del proyecto
const db = JSON.parse(readFileSync(path, 'utf8')) as Database
// Pago de inscripción de Regina Méndez Ortega (familia demo)
const charge = db.charges.find((c) => c.studentId === 'al1' && c.conceptId === 'cp1')!
const payment = db.payments.find((p) => p.chargeId === charge.id)!
const mama = db.guardians.find((g) => g.id === 'tu0')!
const inv = await emitInvoice(db, payment, { rfc: mama.rfc, nombre: mama.taxName, cp: mama.taxZip, regimen: mama.taxRegime, uso: 'G03' }, 'fac-demo-1')
// Fecha fija del ejemplo: el día en que se registró el pago
inv.fecha = `${payment.paidAt}T10:15:00`
inv.fechaTimbrado = `${payment.paidAt}T10:15:04`
inv.xml = inv.xml.replace(/Fecha="[^"]*"/, `Fecha="${inv.fecha}"`).replace(/FechaTimbrado="[^"]*"/, `FechaTimbrado="${inv.fechaTimbrado}"`)
db.invoices = [inv]
payment.invoiceId = inv.id
db.meta.cfdiConfig.nextFolio = inv.folio + 1
writeFileSync(path, JSON.stringify(db) + '\n')
console.log(`Factura demo ${inv.serie}-${inv.folio} agregada (${inv.uuid})`)
