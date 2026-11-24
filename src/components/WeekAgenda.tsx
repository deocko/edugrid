import { useState } from 'react'
import { todayISO } from '../lib/format'
import { Icon } from './Icon'

export interface AgendaItem {
  date: string
  title: string
  detail: string
  /** Clases del cuadro de color de la tarjeta (color de materia o del tipo de evento). */
  tone: string
  /** Hora opcional que se muestra a la izquierda. */
  time?: string
}

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
/** Lunes de la semana de una fecha. */
const monday = (iso: string) => {
  const wd = new Date(`${iso}T12:00:00`).getDay()
  return shift(iso, wd === 0 ? -6 : 1 - wd)
}
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', o)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Agenda semanal: una tira con los días de la semana (hoy marcado) y, al elegir un día, lo que hay
 * ese día. Las flechas cambian de semana y «Hoy» regresa al día actual.
 */
export function WeekAgenda({ items }: { items: AgendaItem[] }) {
  const today = todayISO()
  const [selected, setSelected] = useState(today)
  const [week, setWeek] = useState(monday(today))
  const days = Array.from({ length: 7 }, (_, i) => shift(week, i))
  const count = (d: string) => items.filter((i) => i.date === d).length
  const list = items.filter((i) => i.date === selected).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  const pick = (d: string) => setSelected(d)
  const goToday = () => {
    setWeek(monday(today))
    setSelected(today)
  }

  return (
    <section aria-label="Agenda de la semana" className="mb-5 rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-4xl leading-none font-extrabold tabular-nums text-heading sm:text-5xl">{Number(selected.slice(8, 10))}</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-heading">{cap(fmt(selected, { weekday: 'long' }))}</span>
            <span className="block text-sm text-muted">{cap(fmt(selected, { month: 'long', year: 'numeric' }))}</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setWeek(shift(week, -7))} className="inline-flex size-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2" aria-label="Semana anterior">
            <Icon name="izquierda" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className={`min-h-11 rounded-xl px-4 text-sm font-bold ${selected === today && week === monday(today) ? 'bg-info-bg text-link' : 'bg-primary text-on-primary hover:bg-primary-hover'}`}
          >
            Hoy
          </button>
          <button type="button" onClick={() => setWeek(shift(week, 7))} className="inline-flex size-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2" aria-label="Semana siguiente">
            <Icon name="derecha" />
          </button>
        </div>
      </div>

      <div role="group" aria-label="Días de la semana" className="mt-4 grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((d) => {
          const isSel = d === selected
          const isToday = d === today
          const n = count(d)
          return (
            <button
              key={d}
              type="button"
              onClick={() => pick(d)}
              aria-pressed={isSel}
              aria-label={`${cap(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))}${isToday ? ', hoy' : ''}${n ? `, ${n} ${n === 1 ? 'pendiente' : 'pendientes'}` : ''}`}
              className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 transition ${
                isSel ? 'bg-primary text-on-primary shadow-md' : isToday ? 'bg-info-bg text-link ring-2 ring-primary/40' : 'text-heading hover:bg-surface-2'
              }`}
            >
              <span className={`text-[11px] font-semibold uppercase ${isSel ? '' : 'text-muted'}`}>{fmt(d, { weekday: 'short' }).replace('.', '').slice(0, 3)}</span>
              <span className="text-lg leading-none font-extrabold tabular-nums">{Number(d.slice(8, 10))}</span>
              <span aria-hidden="true" className={`size-1.5 rounded-full ${n ? (isSel ? 'bg-on-primary' : 'bg-cyan') : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>

      <div className="mt-4" aria-live="polite">
        <p className="mb-2 text-sm font-semibold text-muted">{selected === today ? 'Hoy' : cap(fmt(selected, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
        {list.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">No hay eventos ni entregas este día.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((i, idx) => (
              <li key={idx} className="flex gap-3">
                {i.time !== undefined && <span className="w-12 shrink-0 pt-3 text-right text-sm font-semibold tabular-nums text-heading">{i.time}</span>}
                <div className={`min-w-0 flex-1 rounded-2xl px-4 py-3 ${i.tone}`}>
                  <p className="font-bold">{i.title}</p>
                  <p className="text-sm">{i.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
