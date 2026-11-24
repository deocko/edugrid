import type { Database, SubjectColor } from '../data/types'
import { subjectName } from '../lib/scope'
import { SUBJECT_COLORS, subjectClass } from '../lib/subjects'
import { Icon } from './Icon'

/** Punto de color de la materia. */
export function SubjectDot({ db, id, size = 10 }: { db: Database; id: string; size?: number }) {
  return <span aria-hidden="true" style={{ width: size, height: size }} className={`${subjectClass(db, id)} inline-block shrink-0 rounded-full bg-[var(--s)]`} />
}

/** Nombre de la materia con su punto de color. */
export function SubjectTag({ db, id, className = '' }: { db: Database; id: string; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <SubjectDot db={db} id={id} />
      <span className="min-w-0 break-words">{subjectName(db, id)}</span>
    </span>
  )
}


/** Muestrario para elegir el color de una materia. */
export function ColorPicker({ value, onChange, legend }: { value: SubjectColor; onChange: (c: SubjectColor) => void; legend: string }) {
  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-semibold text-heading">{legend}</legend>
      <div role="radiogroup" aria-label={legend} className="flex flex-wrap gap-2">
        {SUBJECT_COLORS.map((c) => {
          const on = c.value === value
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={c.label}
              title={c.label}
              onClick={() => onChange(c.value)}
              className={`subj-${c.value} inline-flex size-11 items-center justify-center rounded-full border-2 transition ${on ? 'border-heading' : 'border-transparent hover:border-line'}`}
            >
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--s)] text-white">{on && <Icon name="check" size={16} />}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
