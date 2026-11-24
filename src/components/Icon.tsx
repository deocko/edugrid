// Iconografía de la app: Lucide (licencia ISC), empaquetada con la app (sin CDN).
// Trazo fino de 1.75 y puntas redondeadas para un estilo limpio y moderno.
// Los nombres en español se mantienen para que el resto del código no dependa de la librería.
import {
  Baby,
  Bell,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  Camera,
  ChartNoAxesColumn,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  DoorOpen,
  Download,
  Eye,
  GraduationCap,
  HeartHandshake,
  House,
  Layers3,
  LockKeyhole,
  LogOut,
  Megaphone,
  Menu,
  MessageSquareText,
  MessagesSquare,
  MonitorSmartphone,
  Moon,
  NotebookPen,
  Plus,
  QrCode,
  ReceiptText,
  RotateCw,
  ScrollText,
  Search,
  SendHorizontal,
  Settings2,
  ShieldCheck,
  Sun,
  Trash2,
  TriangleAlert,
  Upload,
  UsersRound,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react'

const ICONS = {
  inicio: House,
  alumnos: UsersRound,
  docente: GraduationCap,
  estructura: Layers3,
  avisos: Megaphone,
  mensajes: MessageSquareText,
  pagos: WalletCards,
  factura: ReceiptText,
  calendario: CalendarDays,
  horario: Clock3,
  tareas: NotebookPen,
  asistencia: CalendarCheck2,
  calificaciones: ChartNoAxesColumn,
  escudo: ShieldCheck,
  bitacora: ScrollText,
  ajustes: Settings2,
  salir: LogOut,
  sol: Sun,
  qr: QrCode,
  camara: Camera,
  chat: MessagesSquare,
  aula: DoorOpen,
  pantalla: MonitorSmartphone,
  luna: Moon,
  mas: Plus,
  subir: Upload,
  descargar: Download,
  alerta: TriangleAlert,
  campana: Bell,
  menu: Menu,
  cerrar: X,
  derecha: ChevronRight,
  izquierda: ChevronLeft,
  check: Check,
  ojo: Eye,
  candado: LockKeyhole,
  enviar: SendHorizontal,
  buscar: Search,
  hijo: HeartHandshake,
  bebe: Baby,
  libro: BookOpen,
  tarjeta: CreditCard,
  girar: RotateCw,
  borrar: Trash2,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

export function Icon({ name, size = 20, className = '', label }: { name: IconName; size?: number; className?: string; label?: string }) {
  const Svg = ICONS[name]
  return (
    <Svg
      size={size}
      strokeWidth={1.75}
      absoluteStrokeWidth={size < 18}
      className={`shrink-0 ${className}`}
      role={label ? 'img' : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    />
  )
}
