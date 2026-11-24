# EDUGRID — Administra tu Escuela

**Una escuela. Todos conectados.**

EDUGRID es una plataforma web de gestión escolar para escuelas privadas en México (maternal, kinder, primaria, secundaria y preparatoria). Esta es la **primera versión demo**: funciona completa en el navegador con datos ficticios del **Colegio Demo EDUGRID**.

> ⚠️ **DEMO.** Todos los alumnos, familias, docentes, pagos y facturas son inventados. Las facturas no tienen validez fiscal.

## Qué incluye

| Módulo | Para quién | Qué hace |
| --- | --- | --- |
| **EDUGRID Admin** | Dirección y administración | Indicadores, inscripción de alumnos con consentimiento del tutor, edición y baja de alumnos y docentes, asignación de docente por materia y grupo, boleta en PDF, ciclos, trimestres, grados, grupos y materias, matriz de permisos y bitácora. |
| **Academy** | Docentes | Pase de lista por grupo, captura de calificaciones por grupo y materia con cierre de periodo, tareas y horario. |
| **Family** | Papás y mamás | Calificaciones (con boleta en PDF), asistencia, tareas, horario, pagos, estado de cuenta, avisos y calendario de **sus hijos únicamente**. |
| **Student** | Alumnos | Horario, tareas, calificaciones y avisos. En primaria la vista es más sencilla. |
| **Connect** | Todos | Avisos institucionales (escuela, nivel o grupo) y mensajes de grupo con acuse de lectura. |
| **Pay** | Administración y familias | Conceptos (inscripción, colegiatura, otros), cargos por alumno, colegiatura masiva del mes, registro de pagos (efectivo, transferencia, tarjeta; solo registro), adeudos, estado de cuenta y recordatorios. |
| **CFDI** | Administración | Facturas CFDI 4.0 en **modo demo** (XML + PDF con marca DEMO), cancelación con motivo, configuración del emisor y adaptador PAC listo para conectar un PAC real. |

## Cuentas demo

No hay contraseñas. En la pantalla de inicio elige **Entrar como Administrador / Docente / Papá / Alumno** y, si quieres, la cuenta:

| Perfil | Cuenta sugerida | Qué ve |
| --- | --- | --- |
| Administrador | Mtra. Patricia Ruiz (Dirección general) | Todo |
| Docente | Titular de 4° de primaria A | Solo sus grupos |
| Papá / Mamá | Laura Ortega Salinas (2 hijos: 4° de primaria y 2° de secundaria) | Solo sus hijos |
| Alumno | Alumno de 4° de primaria (vista sencilla) o de secundaria/prepa | Solo lo suyo |

El botón **Restablecer datos demo** (en la pantalla de inicio) vuelve a cargar los datos de ejemplo.

## Cómo correrlo en tu computadora

Necesitas Node.js 22 o más reciente.

```bash
npm install
npm run dev        # abre http://localhost:5173/edugrid/
```

Otros comandos:

```bash
npm run build      # revisa tipos y genera dist/
npx tsc --noEmit   # revisión de tipos
npm run lint       # lint sin advertencias
npm run preview    # sirve dist/ en http://localhost:4173/edugrid/
node scripts/generate-seed.mjs   # regenera los datos demo (src/data/seed.json)
```

QA visual (requiere Playwright instalado):

```bash
npm run build && npx vite preview --port 4173 &
node scripts/qa.mjs   # 390/768/1024/1440 px, claro y oscuro, contraste AA, permisos
```

## Despliegue en GitHub Pages

El flujo `.github/workflows/deploy.yml` revisa tipos, lint y build en cada PR, y publica en GitHub Pages al hacer merge a `main`. En el repositorio activa **Settings → Pages → Source: GitHub Actions**. La app se publica en `https://<usuario>.github.io/edugrid/`.

## Tecnología

- React 19 + Vite + TypeScript estricto + Tailwind CSS 4 + React Router (rutas con `#` para que funcionen en Pages).
- PWA: manifiesto, íconos y service worker para abrir sin conexión.
- **Sin CDNs en tiempo de ejecución**: ni Google Fonts ni librerías externas; todo va dentro de la app (fuente del sistema, íconos SVG propios, jsPDF empaquetado). Funciona igual en WiFi y en datos móviles.
- Mobile-first: navegación inferior en celular y tableta, barra lateral en escritorio. Modo claro, oscuro o según el dispositivo.

## Datos y conexión futura con Supabase

La interfaz solo habla con el contrato `EdugridRepository` (`src/data/repository.ts`). Hoy lo implementa `LocalStorageRepository` (guarda en el navegador y arranca con `src/data/seed.json`). Para conectar Supabase se escribe otro adaptador con los mismos métodos (`snapshot`, `list`, `insert`, `update`, `upsert`, `remove`, `updateMeta`, `reset`) y se pasa a `<StoreProvider repository={...}>`, sin tocar las pantallas.

## Permisos y datos de menores

- Matriz obligatoria (`src/lib/permissions.ts`, visible en **Admin → Permisos**): Dirección ve todo; Docente solo sus grupos; Papá/Mamá solo sus hijos; Alumno solo lo suyo.
- Todas las consultas de alumnos pasan por `src/lib/scope.ts`. Si alguien intenta abrir datos que no le corresponden, ve “No tienes acceso” y el intento queda en la bitácora.
- Bitácora de accesos (inicios de sesión, consultas de expedientes y estados de cuenta) y de cambios.
- Aviso de privacidad visible desde el inicio y el menú; la inscripción exige el consentimiento del tutor y las familias sin consentimiento lo pueden otorgar desde su portal.

## Facturación CFDI 4.0: cómo funciona de verdad

En esta versión **el CFDI es solo demostración**. Para facturar de verdad hay que saber tres cosas:

1. **El timbrado no se hace directo con el SAT.** Se hace a través de un **PAC** (Proveedor Autorizado de Certificación) autorizado por el SAT. El PAC valida el XML, le pone el folio fiscal (UUID) y lo reporta al SAT.
2. **La escuela necesita su CSD vigente.** El Certificado de Sello Digital (archivos `.cer` y `.key` con su contraseña) se tramita ante el SAT y es distinto de la e.firma.
3. **Se necesita un contrato con un PAC**, que entrega las credenciales de su servicio.

Qué ya está listo en el código:

- `src/cfdi/xml.ts` arma el XML CFDI 4.0 (ingreso, PUE, IVA exento para servicios educativos, complemento de instituciones educativas **IEDU** con nombre, CURP, nivel y RVOE del alumno).
- `src/cfdi/pdf.ts` genera la representación impresa en PDF con marca de agua **DEMO**.
- `src/cfdi/pac.ts` define la interfaz `PacAdapter` con `timbrar`, `cancelar` y `consultar`. Hoy se usa `DemoPacAdapter` (no se conecta a nada). Para un PAC real se implementa esa misma interfaz llamando a **un servidor propio** (por ejemplo una función de Supabase) que guarde el CSD y las llaves del PAC cifradas. **Nunca** se deben poner credenciales en el navegador ni en este repositorio.
- La pantalla **Facturación → Configuración** guarda solo datos públicos del emisor (RFC, razón social, régimen, CP, serie). Los campos del CSD están deshabilitados en la demo.

## Marca

Paleta del Manual de Identidad v1.0: marino `#101D32`, azul eléctrico `#1769D2`, cyan `#35C5D9`, cloud `#F3F6FA`, blanco `#FFFFFF`, texto `#243247`. El logotipo (`src/brand/Logo.tsx`, `public/logo.svg`) no se recolorea: en modo oscuro se muestra sobre una placa blanca.
