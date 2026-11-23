import { Link } from 'react-router'
import { Logo } from '../brand/Logo'
import { Card, DemoBadge } from '../components/ui'
import { useStore } from '../state/context'

export function Privacy() {
  const { session } = useStore()
  return (
    <div className={session ? '' : 'min-h-dvh bg-bg px-4 py-6'}>
      <div className="mx-auto max-w-3xl">
        {!session && (
          <div className="mb-6 flex items-center justify-between gap-3">
            <Logo height={30} />
            <Link to="/" className="text-sm font-semibold text-link underline">
              Volver al inicio
            </Link>
          </div>
        )}
        <h1 className="text-2xl font-extrabold text-heading sm:text-3xl">Aviso de privacidad</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-muted">
          <DemoBadge /> Texto de ejemplo para la demo. Cada escuela debe publicar su propio aviso con apoyo legal.
        </p>
        <Card className="mt-5 space-y-4 text-ink">
          <section>
            <h2 className="font-bold text-heading">¿Quién cuida tus datos?</h2>
            <p>El Colegio Demo EDUGRID (escuela ficticia) es responsable de los datos personales de alumnos, familias y personal. EDUGRID es la plataforma que la escuela usa para guardarlos de forma segura.</p>
          </section>
          <section>
            <h2 className="font-bold text-heading">¿Qué datos usamos y para qué?</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Datos de identificación del alumno (nombre, fecha de nacimiento, CURP) para su inscripción.</li>
              <li>Datos de contacto de madres, padres o tutores para avisos y emergencias.</li>
              <li>Asistencia y calificaciones para dar seguimiento al aprendizaje.</li>
              <li>Datos de pago y fiscales para emitir recibos y facturas.</li>
            </ul>
          </section>
          <section>
            <h2 className="font-bold text-heading">Datos de menores de edad</h2>
            <p>Solo tratamos datos de niñas, niños y adolescentes con el consentimiento de su madre, padre o tutor. Cada persona ve únicamente lo que le corresponde: la dirección ve todo, cada docente solo a sus grupos, cada familia solo a sus hijos y cada alumno solo lo suyo. Todos los accesos y cambios quedan registrados en una bitácora.</p>
          </section>
          <section>
            <h2 className="font-bold text-heading">Tus derechos</h2>
            <p>Puedes pedir acceso, corrección, cancelación u oposición (derechos ARCO) en la dirección de la escuela. En esta demo no se recibe ninguna solicitud real.</p>
          </section>
        </Card>
      </div>
    </div>
  )
}
