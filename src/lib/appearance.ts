import type { Appearance, Meta, SubjectColor } from '../data/types'
import { artFor } from '../layout/headerArt'

export const DEFAULT_APPEARANCE: Appearance = { cards: 'seccion', menu: 'tarjetas' }

export const appearanceOf = (meta: Meta): Appearance => ({ ...DEFAULT_APPEARANCE, ...meta.appearance })

/** Color de las tarjetas en una ruta (null = blanco). */
export function cardColorFor(a: Appearance, pathname: string): SubjectColor | null {
  if (a.cards === 'blanco') return null
  return a.cards === 'seccion' ? artFor(pathname).color : a.cards
}

/** Color del menú de abajo en una ruta (null = blanco). */
export function menuColorFor(a: Appearance, pathname: string): SubjectColor | null {
  if (a.menu === 'blanco') return null
  return a.menu === 'tarjetas' ? cardColorFor(a, pathname) : a.menu
}
