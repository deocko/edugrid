import { useState, type FormEvent } from 'react'
import { Button, Card, EmptyState, Field, Input, LinkButton, Notice, PageHeader } from '../../components/ui'
import { VirtualCard } from '../../components/VirtualCard'
import type { PaymentCard } from '../../data/types'
import { BRAND_LABEL, TEST_CARDS, cardLength, cvvLength, detectBrand, digits, formatCardNumber, formatExpiry, isExpired, isTestCard, luhn, parseExpiry } from '../../lib/cards'
import { nowISO, todayISO, uid } from '../../lib/format'
import { useApp } from '../../state/context'

/** Tarjetas de la familia: alta con vista previa que se gira, y lista de tarjetas guardadas. */
export function FamilyCards() {
  const { db, session } = useApp()
  const mine = db.cards.filter((c) => c.guardianId === session.personId).sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.createdAt.localeCompare(a.createdAt))
  const [adding, setAdding] = useState(mine.length === 0)
  return (
    <>
      <PageHeader title="Mis tarjetas" subtitle="Guarda una tarjeta para pagar colegiaturas e inscripciones desde la app." />
      <div className="mb-4">
        <Notice tone="aviso" icon="candado">
          Demostración: solo se aceptan tarjetas de prueba. No escribas los datos de una tarjeta real.
        </Notice>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Tarjetas guardadas" action={!adding && <Button variant="secundario" icon="mas" onClick={() => setAdding(true)}>Agregar tarjeta</Button>}>
          {mine.length === 0 ? (
            <EmptyState icon="tarjeta" title="Aún no tienes tarjetas" />
          ) : (
            <ul className="space-y-6">
              {mine.map((c) => (
                <SavedCard key={c.id} card={c} />
              ))}
            </ul>
          )}
          {mine.length > 0 && <LinkButton to="/familia/pagos" icon="pagos" className="mt-6 w-full">Ir a pagar</LinkButton>}
        </Card>
        {adding && <AddCard onDone={() => setAdding(false)} first={mine.length === 0} />}
      </div>
    </>
  )
}

function SavedCard({ card }: { card: PaymentCard }) {
  const { db, act } = useApp()
  const [flipped, setFlipped] = useState(false)
  const expired = isExpired(card.expMonth, card.expYear, todayISO())
  const label = `${BRAND_LABEL[card.brand]} terminación ${card.last4}`
  const remove = () =>
    act(
      async (repo) => {
        await repo.remove('cards', card.id)
        const next = db.cards.find((c) => c.guardianId === card.guardianId && c.id !== card.id)
        if (card.isDefault && next) await repo.update('cards', next.id, { isDefault: true })
      },
      { action: 'Eliminó tarjeta', detail: label },
    )
  const makeDefault = () =>
    act(
      async (repo) => {
        for (const c of db.cards.filter((x) => x.guardianId === card.guardianId)) await repo.update('cards', c.id, { isDefault: c.id === card.id })
      },
      { action: 'Cambió tarjeta principal', detail: label },
    )
  return (
    <li className="flex flex-col items-center gap-3">
      <VirtualCard brand={card.brand} last4={card.last4} holder={card.holder} expiry={formatExpiry(card.expMonth, card.expYear)} flipped={flipped} onFlip={() => setFlipped(!flipped)} schoolName={db.meta.school.shortName} />
      <div className="flex w-full max-w-[22rem] flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-heading">
          {label}
          {card.isDefault && <span className="ml-2 rounded-full bg-info-bg px-2 py-0.5 text-xs text-info">Principal</span>}
          {expired && <span className="ml-2 rounded-full bg-danger-bg px-2 py-0.5 text-xs text-danger">Vencida</span>}
        </p>
        <div className="flex flex-wrap gap-1">
          <Button variant="fantasma" icon="girar" onClick={() => setFlipped(!flipped)} aria-pressed={flipped}>Girar</Button>
          {!card.isDefault && <Button variant="fantasma" icon="check" onClick={() => void makeDefault()}>Principal</Button>}
          <Button variant="fantasma" icon="borrar" onClick={() => void remove()} aria-label={`Eliminar ${label}`}>Eliminar</Button>
        </div>
      </div>
    </li>
  )
}

function AddCard({ onDone, first }: { onDone: () => void; first: boolean }) {
  const { db, session, act } = useApp()
  const [number, setNumber] = useState('')
  const [holder, setHolder] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [flipped, setFlipped] = useState(false)
  const [error, setError] = useState('')
  const brand = detectBrand(number)

  const onExpiry = (v: string) => {
    const d = digits(v).slice(0, 4)
    setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d)
  }
  const fillTest = (n: string) => {
    setNumber(formatCardNumber(n))
    if (!holder) setHolder(session.name)
    if (!expiry) setExpiry('12/29')
    setError('')
  }
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const d = digits(number)
    if (!brand) return setError('Escribe un número de tarjeta Visa, Mastercard o American Express.')
    if (d.length !== cardLength(brand) || !luhn(d)) return setError('El número de tarjeta no es válido. Revísalo.')
    if (!isTestCard(d)) return setError('En la demo solo se aceptan tarjetas de prueba. Usa uno de los botones de «Tarjetas de prueba».')
    if (!holder.trim()) return setError('Escribe el nombre como aparece en la tarjeta.')
    const exp = parseExpiry(expiry)
    if (!exp) return setError('Escribe el vencimiento como MM/AA.')
    if (isExpired(exp.month, exp.year, todayISO())) return setError('La tarjeta está vencida.')
    if (digits(cvv).length !== cvvLength(brand)) return setError(`El código de seguridad tiene ${cvvLength(brand)} dígitos.`)
    const card: PaymentCard = { id: uid('tj'), guardianId: session.personId, brand, last4: d.slice(-4), holder: holder.trim(), expMonth: exp.month, expYear: exp.year, isDefault: first, createdAt: nowISO(), demo: true }
    await act((repo) => repo.insert('cards', [card]), { action: 'Agregó tarjeta', detail: `${BRAND_LABEL[brand]} terminación ${card.last4}` })
    // El número completo y el código de seguridad se descartan aquí: no se guardan en ningún lado.
    setNumber('')
    setCvv('')
    onDone()
  }

  return (
    <Card title="Agregar tarjeta">
      <div className="mb-5 flex justify-center">
        <VirtualCard brand={brand} number={formatCardNumber(number)} holder={holder} expiry={expiry} cvv={cvv} flipped={flipped} onFlip={() => setFlipped(!flipped)} schoolName={db.meta.school.shortName} />
      </div>
      <div className="mb-4">
        <p className="mb-2 text-sm font-semibold text-heading">Tarjetas de prueba</p>
        <div className="flex flex-wrap gap-2">
          {TEST_CARDS.map((t) => (
            <Button key={t.brand} variant="secundario" icon="tarjeta" onClick={() => fillTest(t.number)}>{BRAND_LABEL[t.brand]}</Button>
          ))}
        </div>
      </div>
      <form onSubmit={(e) => void save(e)} className="space-y-3" noValidate autoComplete="off">
        <Field label="Número de tarjeta">
          {(id) => <Input id={id} value={number} inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" onFocus={() => setFlipped(false)} onChange={(e) => setNumber(formatCardNumber(e.target.value))} className="font-mono tracking-wider" />}
        </Field>
        <Field label="Nombre como aparece en la tarjeta">{(id) => <Input id={id} value={holder} autoComplete="off" onFocus={() => setFlipped(false)} onChange={(e) => setHolder(e.target.value)} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vence (MM/AA)">{(id) => <Input id={id} value={expiry} inputMode="numeric" autoComplete="off" placeholder="12/29" onFocus={() => setFlipped(false)} onChange={(e) => onExpiry(e.target.value)} className="font-mono" />}</Field>
          <Field label="Código de seguridad" hint="Al reverso de la tarjeta.">
            {(id) => <Input id={id} value={cvv} type="password" inputMode="numeric" autoComplete="off" maxLength={4} placeholder={brand === 'amex' ? '••••' : '•••'} onFocus={() => setFlipped(true)} onBlur={() => setFlipped(false)} onChange={(e) => setCvv(digits(e.target.value).slice(0, cvvLength(brand)))} className="font-mono" />}
          </Field>
        </div>
        {error && <Notice tone="peligro">{error}</Notice>}
        <p className="text-xs text-muted">Solo guardamos la marca, los últimos 4 dígitos y el vencimiento. El número completo y el código no se guardan.</p>
        <div className="flex flex-wrap justify-end gap-2">
          {!first && <Button variant="secundario" onClick={onDone}>Cancelar</Button>}
          <Button type="submit" icon="candado">Guardar tarjeta</Button>
        </div>
      </form>
    </Card>
  )
}
