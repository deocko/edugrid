import { useState, type FormEvent } from 'react'
import { REGIMENES, RFC_DEMO_RE, RFC_RE } from '../../cfdi/catalogs'
import { getPacAdapter } from '../../cfdi/pac'
import { Button, Card, DemoBadge, Field, Input, Notice, PageHeader, Select } from '../../components/ui'
import { useApp } from '../../state/context'

export function CfdiConfigPage() {
  const { db, act } = useApp()
  const cfg = db.meta.cfdiConfig
  const [form, setForm] = useState({ rfcEmisor: cfg.rfcEmisor, razonSocial: cfg.razonSocial, regimenFiscal: cfg.regimenFiscal, codigoPostal: cfg.codigoPostal, serie: cfg.serie })
  const [msg, setMsg] = useState<{ tone: 'exito' | 'peligro' | 'info'; text: string } | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!RFC_RE.test(form.rfcEmisor.toUpperCase()) && !RFC_DEMO_RE.test(form.rfcEmisor.toUpperCase())) return setMsg({ tone: 'peligro', text: 'El RFC del emisor no tiene un formato válido.' })
    if (!/^\d{5}$/.test(form.codigoPostal)) return setMsg({ tone: 'peligro', text: 'El código postal debe tener 5 dígitos.' })
    await act((repo) => repo.updateMeta({ cfdiConfig: { ...cfg, ...form, rfcEmisor: form.rfcEmisor.toUpperCase(), razonSocial: form.razonSocial.toUpperCase() } }), { action: 'Actualizó configuración fiscal (demo)', detail: `RFC ${form.rfcEmisor.toUpperCase()} · régimen ${form.regimenFiscal}` })
    setMsg({ tone: 'exito', text: 'Configuración guardada. Solo se guardan datos públicos del emisor; nunca credenciales.' })
  }

  const test = async () => {
    const pac = getPacAdapter(cfg.pacProvider)
    const r = await pac.consultar('00000000-0000-4000-A000-000000000000')
    setMsg({ tone: 'info', text: `${pac.nombre}: responde "${r.estado}". En modo demo no hay conexión con ningún PAC ni con el SAT.` })
  }

  return (
    <>
      <PageHeader title="Configuración de facturación" subtitle={<span className="inline-flex flex-wrap items-center gap-2">Datos del emisor, certificado y PAC <DemoBadge /></span>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Datos del emisor" className="lg:col-span-2">
          <form onSubmit={(e) => void save(e)} className="grid gap-3 sm:grid-cols-2" noValidate>
            <Field label="RFC del emisor">{(id) => <Input id={id} value={form.rfcEmisor} maxLength={13} onChange={(e) => setForm({ ...form, rfcEmisor: e.target.value.toUpperCase() })} />}</Field>
            <Field label="Código postal (lugar de expedición)">{(id) => <Input id={id} value={form.codigoPostal} maxLength={5} inputMode="numeric" onChange={(e) => setForm({ ...form, codigoPostal: e.target.value })} />}</Field>
            <div className="sm:col-span-2">
              <Field label="Razón social">{(id) => <Input id={id} value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} />}</Field>
            </div>
            <Field label="Régimen fiscal">
              {(id) => (
                <Select id={id} value={form.regimenFiscal} onChange={(e) => setForm({ ...form, regimenFiscal: e.target.value })}>
                  {Object.entries(REGIMENES).filter(([k]) => ['601', '603'].includes(k)).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Serie de facturas">{(id) => <Input id={id} value={form.serie} maxLength={10} onChange={(e) => setForm({ ...form, serie: e.target.value.toUpperCase() })} />}</Field>
            {msg && <div className="sm:col-span-2"><Notice tone={msg.tone} icon={msg.tone === 'exito' ? 'check' : 'alerta'}>{msg.text}</Notice></div>}
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
              <Button variant="secundario" onClick={() => void test()}>Probar conexión con el PAC</Button>
              <Button type="submit" icon="check">Guardar</Button>
            </div>
          </form>
        </Card>
        <div className="space-y-4">
          <Card title="Certificado de Sello Digital (CSD)">
            <Notice tone="aviso" icon="candado">En la demo no se cargan ni se guardan archivos .cer, .key ni contraseñas.</Notice>
            <div className="mt-3 space-y-2 text-sm">
              <Field label="Archivo .cer">{(id) => <Input id={id} type="file" disabled aria-describedby="csd-nota" />}</Field>
              <Field label="Archivo .key">{(id) => <Input id={id} type="file" disabled aria-describedby="csd-nota" />}</Field>
              <p id="csd-nota" className="text-xs text-muted">Cuando se conecte un PAC real, el CSD se guardará cifrado en un servidor seguro, nunca en el navegador.</p>
            </div>
          </Card>
          <Card title="Proveedor de timbrado (PAC)">
            <Field label="PAC">
              {(id) => (
                <Select id={id} value={cfg.pacProvider} disabled>
                  <option value="demo">PAC de demostración (sin conexión)</option>
                </Select>
              )}
            </Field>
            <p className="mt-2 text-xs text-muted">Próximamente: conexión con un PAC autorizado por el SAT.</p>
          </Card>
        </div>
      </div>
      <Card title="¿Cómo funciona la facturación real?" className="mt-4">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>El timbrado <strong>no se hace directo con el SAT</strong>: se hace a través de un <strong>PAC</strong> (Proveedor Autorizado de Certificación) autorizado por el SAT.</li>
          <li>La escuela necesita su <strong>CSD vigente</strong> (Certificado de Sello Digital, distinto de la e.firma) y un <strong>contrato con el PAC</strong>.</li>
          <li>EDUGRID arma el XML CFDI 4.0, lo sella con el CSD y lo manda al PAC, que le agrega el folio fiscal (UUID) y lo reporta al SAT.</li>
          <li>Para cancelar se indica el motivo (01 a 04) y, según el monto y el tiempo, el receptor puede tener que aceptar la cancelación.</li>
        </ol>
      </Card>
    </>
  )
}
