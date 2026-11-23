import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { RequireRole } from './components/guards'
import { Button, ErrorState, LoadingState } from './components/ui'
import { AppShell } from './layout/AppShell'
import { HOME_BY_ROLE } from './lib/permissions'
import { AdminHome } from './pages/admin/AdminHome'
import { AuditLog } from './pages/admin/AuditLog'
import { Permissions } from './pages/admin/Permissions'
import { SchoolStructure } from './pages/admin/SchoolStructure'
import { StudentDetail } from './pages/admin/StudentDetail'
import { Students } from './pages/admin/Students'
import { Teachers } from './pages/admin/Teachers'
import { AttendancePage } from './pages/academy/AttendancePage'
import { GradesPage } from './pages/academy/GradesPage'
import { HomeworkPage } from './pages/academy/HomeworkPage'
import { SchedulePage } from './pages/academy/SchedulePage'
import { TeacherHome } from './pages/academy/TeacherHome'
import { CfdiConfigPage } from './pages/cfdi/CfdiConfigPage'
import { InvoicesPage } from './pages/cfdi/InvoicesPage'
import { ConnectPage } from './pages/connect/ConnectPage'
import { ChildPage } from './pages/family/ChildPage'
import { FamilyCalendar } from './pages/family/FamilyCalendar'
import { FamilyHome } from './pages/family/FamilyHome'
import { FamilyPayments } from './pages/family/FamilyPayments'
import { Login } from './pages/Login'
import { PayPage } from './pages/pay/PayPage'
import { StatementPage } from './pages/pay/StatementPage'
import { Privacy } from './pages/Privacy'
import { StudentGrades, StudentHome, StudentHomework, StudentSchedule } from './pages/student/StudentPages'
import { useStore } from './state/context'

export function App() {
  const { status, error, session, resetDemo } = useStore()

  if (status === 'cargando') return <LoadingState label="Cargando EDUGRID…" />
  if (status === 'error')
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState
          title="No pudimos abrir los datos de la demo"
          action={
            <Button variant="secundario" onClick={() => void resetDemo().then(() => location.reload())}>
              Restablecer datos demo
            </Button>
          }
        >
          {error}
        </ErrorState>
      </div>
    )

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={session ? <Navigate to={HOME_BY_ROLE[session.role]} replace /> : <Login />} />
        {!session && <Route path="/privacidad" element={<Privacy />} />}
        <Route element={session ? <AppShell /> : <Navigate to="/" replace />}>
          <Route path="/privacidad" element={<Privacy />} />
          <Route path="/admin" element={<RequireRole roles={['admin']}><AdminHome /></RequireRole>} />
          <Route path="/admin/alumnos" element={<RequireRole roles={['admin']}><Students /></RequireRole>} />
          <Route path="/alumnos/:id" element={<RequireRole roles={['admin', 'docente']}><StudentDetail /></RequireRole>} />
          <Route path="/admin/docentes" element={<RequireRole roles={['admin']}><Teachers /></RequireRole>} />
          <Route path="/admin/escuela" element={<RequireRole roles={['admin']}><SchoolStructure /></RequireRole>} />
          <Route path="/admin/permisos" element={<RequireRole roles={['admin']}><Permissions /></RequireRole>} />
          <Route path="/admin/bitacora" element={<RequireRole roles={['admin']}><AuditLog /></RequireRole>} />

          <Route path="/docente" element={<RequireRole roles={['docente']}><TeacherHome /></RequireRole>} />
          <Route path="/docente/asistencia" element={<RequireRole roles={['docente', 'admin']}><AttendancePage /></RequireRole>} />
          <Route path="/docente/calificaciones" element={<RequireRole roles={['docente', 'admin']}><GradesPage /></RequireRole>} />
          <Route path="/docente/tareas" element={<RequireRole roles={['docente']}><HomeworkPage /></RequireRole>} />
          <Route path="/docente/horario" element={<RequireRole roles={['docente']}><SchedulePage /></RequireRole>} />

          <Route path="/familia" element={<RequireRole roles={['familia']}><FamilyHome /></RequireRole>} />
          <Route path="/familia/hijo/:id" element={<RequireRole roles={['familia']}><ChildPage /></RequireRole>} />
          <Route path="/familia/pagos" element={<RequireRole roles={['familia']}><FamilyPayments /></RequireRole>} />
          <Route path="/familia/calendario" element={<RequireRole roles={['familia']}><FamilyCalendar /></RequireRole>} />

          <Route path="/alumno" element={<RequireRole roles={['alumno']}><StudentHome /></RequireRole>} />
          <Route path="/alumno/horario" element={<RequireRole roles={['alumno']}><StudentSchedule /></RequireRole>} />
          <Route path="/alumno/tareas" element={<RequireRole roles={['alumno']}><StudentHomework /></RequireRole>} />
          <Route path="/alumno/calificaciones" element={<RequireRole roles={['alumno']}><StudentGrades /></RequireRole>} />

          <Route path="/avisos" element={<ConnectPage />} />

          <Route path="/pagos" element={<RequireRole roles={['admin']}><PayPage /></RequireRole>} />
          <Route path="/pagos/estado/:id" element={<RequireRole roles={['admin', 'familia']}><StatementPage /></RequireRole>} />
          <Route path="/facturacion" element={<RequireRole roles={['admin']}><InvoicesPage /></RequireRole>} />
          <Route path="/facturacion/configuracion" element={<RequireRole roles={['admin']}><CfdiConfigPage /></RequireRole>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
