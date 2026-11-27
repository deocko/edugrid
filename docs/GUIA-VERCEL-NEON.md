# Publicar EDUGRID en Vercel con la base de datos de Neon

Guía paso a paso, pensada para hacerse desde el celular. Toma unos 10 minutos.

Al terminar tendrás EDUGRID en una dirección de Vercel (algo como `edugrid-xxxx.vercel.app`) guardando los datos en tu base de Neon, rama **dev**. Lo que cambie una persona lo verá otra desde cualquier dispositivo.

> 🔒 **La cadena de conexión es una contraseña.** Solo se pega en Vercel, en la variable `DATABASE_URL`. Nunca en el chat, en GitHub, en un correo ni en un archivo. Si alguna vez se filtra, ve a Neon → tu proyecto → **Roles** → **Reset password** y pega la nueva en Vercel.

---

## Parte 1 · Ten a la mano la cadena de la rama dev

Ya la guardaste en tu gestor de contraseñas. Si necesitas copiarla otra vez:

1. Entra a **console.neon.tech** y abre el proyecto **edugrid**.
2. Toca el botón **Connect**.
3. En **Branch** elige **dev** (no production).
4. Copia la cadena completa. Empieza con `postgresql://` y termina con `sslmode=require` (o parecido).

## Parte 2 · Crear el proyecto en Vercel

1. Entra a **vercel.com** y toca **Sign Up** → **Continue with GitHub**. Usa tu cuenta `deocko`. El plan **Hobby** (gratis) alcanza.
   - Si te pide nombre de equipo, puedes poner **BlueDataGrid**.
2. Toca **Add New…** → **Project**.
3. En **Import Git Repository** busca **edugrid**.
   - Si no aparece, toca **Adjust GitHub App Permissions** (o **Configure GitHub App**), elige **Only select repositories** → **deocko/edugrid** → **Save**, y regresa.
4. Toca **Import** junto a **edugrid**.
5. En la pantalla **Configure Project**:
   - **Project Name:** `edugrid`
   - **Framework Preset:** debe decir **Vite** (sale solo). Si no, elígelo.
   - **Root Directory:** déjalo como está (`./`).
   - **Build and Output Settings:** no cambies nada.
6. Abre **Environment Variables** y agrega una:
   - **Key:** `DATABASE_URL`
   - **Value:** pega la cadena de la rama **dev**.
   - Toca **Add**.
7. Toca **Deploy** y espera a que termine.

> El primer despliegue sale de la rama `main`, que todavía está vacía (el código está en los PR de cada mensaje), así que **falla con «vite: command not found»**. Es normal. La versión con base de datos es la de la Parte 3.

## Parte 3 · Abrir la versión con base de datos

1. En GitHub abre el pull request **«Mensaje 9: base de datos Neon»**. Vercel deja un comentario con el enlace **Visit Preview**. Tócalo.
   - También lo encuentras en Vercel → proyecto **edugrid** → **Deployments**: el de la rama `claude/edugrid-mensaje-9-base-de-datos`.
   - Si no aparece ninguno de esa rama, avísame y lo vuelvo a disparar.
2. **Revisa la conexión:** a esa dirección agrégale `/api/salud` al final, por ejemplo `https://edugrid-git-claude-edugrid-mensaje-9-….vercel.app/api/salud`. Debe decir:
   - `"ok": true` y `"mensaje": "EDUGRID está conectado a la base de datos."`
   - `"aislamiento": "Row Level Security por escuela"` (o «Filtro por escuela…», que también protege)
   - `"students": 64` en registros.
3. **Abre la app** (la dirección sin `/api/salud`). Hasta abajo de la pantalla de inicio debe decir **«Datos: Base de datos en línea»**.
4. **Pruébala:** entra como Familia → **Mi perfil** → cambia el teléfono → **Guardar cambios**. Abre la misma dirección en otro celular o computadora: el teléfono nuevo ya está ahí.
5. En Neon → proyecto **edugrid** → rama **dev** → **Tables** verás las tablas que se crearon solas: `escuelas`, `students`, `payments`, `grade_records`… Cada una tiene la columna `school_id`.

La primera vez tarda unos segundos más: es cuando se crean las tablas y se cargan los datos DEMO.

## Si algo sale mal

| Lo que ves | Qué hacer |
| --- | --- |
| «Falta configurar DATABASE_URL en Vercel» | Vercel → **Settings** → **Environment Variables** → agrega `DATABASE_URL`. Luego **Deployments** → los tres puntos del último → **Redeploy**. |
| «No se pudo conectar con la base de datos» | Revisa que la cadena esté completa (sin espacios al inicio o al final) y que sea de la rama **dev**. Corrígela en Environment Variables y haz **Redeploy**. |
| Te pide iniciar sesión en Vercel al abrir el enlace | Es la protección de las versiones de prueba: solo tú las ves. Para que otras personas entren: **Settings** → **Deployment Protection** → apaga **Vercel Authentication**. |
| La pantalla de inicio dice «Datos: Local (demo en este navegador)» | Estás en GitHub Pages o en el despliegue de `main`, no en el del mensaje 9. |
| Aparece «No se guardó el cambio» | Se perdió la conexión o falló el servidor. El cambio no se guardó; inténtalo de nuevo. |

## Variables opcionales

Solo si las necesitas, en **Settings → Environment Variables**:

| Variable | Valor | Para qué |
| --- | --- | --- |
| `EDUGRID_PERMITIR_REINICIO` | `no` | Que nadie pueda usar «Restablecer datos demo». |
| `EDUGRID_SEMILLA_DEMO` | `no` | Que una base vacía no se llene con los datos de ejemplo. |
| `EDUGRID_ESCUELA` | p. ej. `montesol` | Escuela que atiende este despliegue (por omisión `demo`). |

### Cuentas reales y correos (Mensaje 10)

| Variable | Valor | Para qué |
| --- | --- | --- |
| `RESEND_API_KEY` | la llave de Resend (márcala **Sensitive**) | Mandar de verdad los correos de invitación y de recuperar contraseña. Sin ella, EDUGRID **no envía nada** y queda en modo demo: lo registra en el log (sin la liga), las invitaciones muestran su liga en pantalla (solo fuera de Production) y la recuperación de contraseña **nunca** la muestra. |
| `EDUGRID_CORREO_REMITENTE` | p. ej. `EDUGRID <no-responder@tudominio.mx>` | Remitente de los correos. Debe ser de un dominio verificado en Resend. Si falta, se usa `onboarding@resend.dev`, que solo entrega al correo dueño de la cuenta de Resend (sirve para probar). |
| `EDUGRID_URL_APP` | p. ej. `https://app.tudominio.mx` | Dirección que llevan las ligas de los correos. Si no se pone, se usa la del sitio que hizo la petición. |
| `EDUGRID_CONTACTO` | un correo o una liga | A dónde lleva el botón «Contactar para contratar» cuando termina la prueba. |
| `EDUGRID_SIMULAR_PRUEBA` | `si` | Muestra «Solo pruebas: terminar la prueba» en el tablero. En las versiones Preview ya aparece solo; nunca lo actives en Production. |

Las contraseñas se guardan solo como hash (scrypt) en la tabla `usuarios`; los tokens de sesión, invitación y recuperación, solo como huella (sha-256). Ninguna llave va en el código.

## Más adelante

- **Rama production de Neon:** ahora que hay inicio de sesión real, cuando entren datos de una escuela de verdad, en Vercel se pone la cadena de **production** solo para el entorno **Production**, con `EDUGRID_SEMILLA_DEMO=no`. La rama **dev** se queda para pruebas.
- **Cambiar de hosting:** la API es Node estándar. Si después prefieres un VPS con Coolify o Dokploy, se usa `npm run build:servidor` y `npm run servidor` con la misma `DATABASE_URL`, sin reescribir nada.
- **Archivos** (fotos, tareas, recibos): irán a un almacenamiento de archivos (R2/S3), no a la base de datos.
