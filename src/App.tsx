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
import { Families } from './pages/admin/Families'
import { Rooms } from './pages/admin/Rooms'
import { Classes } from './pages/admin/Classes'
import { StatusPage } from './pages/academy/StatusPage'
import { ChatPage } from './pages/connect/ChatPage'
import { NotificationsPage } from './pages/connect/NotificationsPage'
import { QrPage } from './pages/family/QrPage'
import { ScanPage } from './pages/shared/ScanPage'
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
import { DemoLogin } from './pages/DemoLogin'
import { RegistroEscuela } from './pages/cuenta/RegistroEscuela'
import { Invitacion } from './pages/cuenta/Invitacion'
import { Restablecer } from './pages/cuenta/Restablecer'
import { PruebaTerminada } from './pages/cuenta/PruebaTerminada'
import { PayPage } from './pages/pay/PayPage'
import { StatementPage } from './pages/pay/StatementPage'
import { Privacy } from './pages/Privacy'
import { StudentGrades, StudentHome, StudentHomework, StudentSchedule } from './pages/student/StudentPages'
import { useStore } from './state/context'
import { BrandStyle } from './brand/SchoolBrand'
import { SchoolSettings } from './pages/admin/SchoolSettings'
import { FamilyCards } from './pages/family/FamilyCards'
import { AdminCalendar } from './pages/admin/AdminCalendar'
import { SettingsHub } from './pages/admin/SettingsHub'
import { CheckinPlaces } from './pages/admin/CheckinPlaces'
import { ProfilePage } from './pages/shared/ProfilePage'

export function App() {
  const { status, error, session, resetDemo, esDemo, cuenta, logout } = useStore()

  // La prueba de 30 días terminó: no se entra a los datos de la escuela.
  if (cuenta?.escuela.pruebaVencida)
    return (
      <HashRouter>
        <PruebaTerminada />
      </HashRouter>
    )
  if (session && (status === 'cargando' || status === 'sin-datos')) return <LoadingState label="Cargando EDUGRID…" />
  if (session && status === 'error')
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState
          title={esDemo ? 'No pudimos abrir los datos de la demo' : 'No pudimos abrir los datos de tu escuela'}
          action={
            esDemo ? (
              <Button variant="secundario" onClick={() => void resetDemo().then(() => location.reload())}>
                Restablecer datos demo
              </Button>
            ) : (
              <Button variant="secundario" onClick={logout}>
                Cerrar sesión
              </Button>
            )
          }
        >
          {error}
        </ErrorState>
      </div>
    )

  return (
    <HashRouter>
      <BrandStyle />
      <Routes>
        <Route path="/" element={session ? <Navigate to={HOME_BY_ROLE[session.role]} replace /> : <Login />} />
        {/* Pantallas públicas: abrir una invitación o la liga de recuperar contraseña funciona con o sin sesión. */}
        <Route path="/invitacion/:token" element={<Invitacion />} />
        <Route path="/restablecer/:token" element={<Restablecer />} />
        {!session && <Route path="/demo" element={<DemoLogin />} />}
        {!session && <Route path="/registro-escuela" element={<RegistroEscuela />} />}
        {!session && <Route path="/privacidad" element={<Privacy />} />}
        <Route element={session ? <AppShell /> : <Navigate to="/" replace />}>
          <Route path="/privacidad" element={<Privacy />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/admin" element={<RequireRole roles={['admin']}><AdminHome /></RequireRole>} />
          <Route path="/admin/alumnos" element={<RequireRole roles={['admin']}><Students /></RequireRole>} />
          <Route path="/alumnos/:id" element={<RequireRole roles={['admin', 'docente']}><StudentDetail /></RequireRole>} />
          <Route path="/admin/familias" element={<RequireRole roles={['admin']}><Families /></RequireRole>} />
          <Route path="/admin/aulas" element={<RequireRole roles={['admin']}><Rooms /></RequireRole>} />
          <Route path="/admin/clases" element={<RequireRole roles={['admin']}><Classes /></RequireRole>} />
          <Route path="/admin/entradas" element={<RequireRole roles={['admin']}><ScanPage /></RequireRole>} />
          <Route path="/admin/docentes" element={<RequireRole roles={['admin']}><Teachers /></RequireRole>} />
          <Route path="/admin/escuela" element={<RequireRole roles={['admin']}><SchoolStructure /></RequireRole>} />
          <Route path="/mas" element={<RequireRole roles={['docente', 'familia', 'alumno']}><SettingsHub /></RequireRole>} />
          <Route path="/admin/ajustes" element={<RequireRole roles={['admin']}><SettingsHub /></RequireRole>} />
          <Route path="/admin/calificaciones" element={<RequireRole roles={['admin']}><GradesPage /></RequireRole>} />
          <Route path="/admin/calendario" element={<RequireRole roles={['admin']}><AdminCalendar /></RequireRole>} />
          <Route path="/admin/configuracion" element={<RequireRole roles={['admin']}><SchoolSettings /></RequireRole>} />
          <Route path="/admin/lugares-qr" element={<RequireRole roles={['admin']}><CheckinPlaces /></RequireRole>} />
          <Route path="/admin/permisos" element={<RequireRole roles={['admin']}><Permissions /></RequireRole>} />
          <Route path="/admin/bitacora" element={<RequireRole roles={['admin']}><AuditLog /></RequireRole>} />

          <Route path="/docente" element={<RequireRole roles={['docente']}><TeacherHome /></RequireRole>} />
          <Route path="/docente/asistencia" element={<RequireRole roles={['docente', 'admin']}><AttendancePage /></RequireRole>} />
          <Route path="/docente/calificaciones" element={<RequireRole roles={['docente', 'admin']}><GradesPage /></RequireRole>} />
          <Route path="/docente/tareas" element={<RequireRole roles={['docente']}><HomeworkPage /></RequireRole>} />
          <Route path="/docente/entradas" element={<RequireRole roles={['docente']}><ScanPage /></RequireRole>} />
          <Route path="/docente/novedades" element={<RequireRole roles={['docente']}><StatusPage /></RequireRole>} />
          <Route path="/docente/chat" element={<RequireRole roles={['docente']}><ChatPage /></RequireRole>} />
          <Route path="/docente/horario" element={<RequireRole roles={['docente']}><SchedulePage /></RequireRole>} />

          <Route path="/familia" element={<RequireRole roles={['familia']}><FamilyHome /></RequireRole>} />
          <Route path="/familia/hijo/:id" element={<RequireRole roles={['familia']}><ChildPage /></RequireRole>} />
          <Route path="/familia/tarjetas" element={<RequireRole roles={['familia']}><FamilyCards /></RequireRole>} />
          <Route path="/familia/pagos" element={<RequireRole roles={['familia']}><FamilyPayments /></RequireRole>} />
          <Route path="/familia/qr" element={<RequireRole roles={['familia']}><QrPage /></RequireRole>} />
          <Route path="/familia/chat" element={<RequireRole roles={['familia']}><ChatPage /></RequireRole>} />
          <Route path="/familia/calendario" element={<RequireRole roles={['familia']}><FamilyCalendar /></RequireRole>} />

          <Route path="/alumno" element={<RequireRole roles={['alumno']}><StudentHome /></RequireRole>} />
          <Route path="/alumno/horario" element={<RequireRole roles={['alumno']}><StudentSchedule /></RequireRole>} />
          <Route path="/alumno/tareas" element={<RequireRole roles={['alumno']}><StudentHomework /></RequireRole>} />
          <Route path="/alumno/qr" element={<RequireRole roles={['alumno']}><QrPage /></RequireRole>} />
          <Route path="/alumno/calificaciones" element={<RequireRole roles={['alumno']}><StudentGrades /></RequireRole>} />

          <Route path="/avisos" element={<ConnectPage />} />
          <Route path="/notificaciones" element={<NotificationsPage />} />

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
