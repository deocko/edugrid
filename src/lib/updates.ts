import type { StudentUpdate } from '../data/types'

export const UPDATE_LABEL: Record<StudentUpdate['category'], string> = {
  llego: 'Llegó bien',
  comio: 'Comió bien',
  participo: 'Participó en clase',
  logro: 'Logro del día',
  necesita: 'Necesita algo',
  salud: 'Salud',
  otro: 'Otro',
}
