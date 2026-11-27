import type { Consulta, Ejecutor } from './db.js'
import { NOMBRES_TABLAS, tablaSql } from './tablas.js'

/** Rol sin privilegios especiales con el que corren las consultas de datos, para que Postgres aplique RLS. */
export const ROL_APP = 'edugrid_app'

const TODAS = ['"escuelas"', ...NOMBRES_TABLAS.map(tablaSql)]

/** Tablas de cuentas (Mensaje 10). También llevan school_id y la misma política RLS. */
export const TABLAS_CUENTAS = ['"usuarios"', '"perfiles"', '"invitaciones"', '"sesiones"', '"recuperaciones"']

/**
 * Aislamiento por escuela con Row Level Security: cada tabla solo deja ver y
 * cambiar las filas cuyo school_id es la escuela de la transacción
 * (`edugrid.escuela`). Si nadie la fijó, no se ve nada.
 */
const rls = (tabla: string): string[] => [
  `alter table ${tabla} enable row level security`,
  `alter table ${tabla} force row level security`,
  `drop policy if exists solo_su_escuela on ${tabla}`,
  `create policy solo_su_escuela on ${tabla}
  using (school_id = current_setting('edugrid.escuela', true))
  with check (school_id = current_setting('edugrid.escuela', true))`,
]

/**
 * Migraciones en orden. Nunca se edita una que ya se aplicó: los cambios nuevos
 * van en una migración nueva con el siguiente número.
 */
export const MIGRACIONES: { version: number; nombre: string; sql: string[] }[] = [
  {
    version: 1,
    nombre: 'Tablas iniciales de EDUGRID con school_id y RLS',
    sql: [
      // Una fila por escuela, con su configuración (nombre, marca, CFDI…). Todas las
      // demás tablas llevan school_id: cada escuela solo ve sus propios datos.
      `create table if not exists "escuelas" (
  school_id text primary key,
  data jsonb not null,
  creada timestamptz not null default now(),
  actualizado timestamptz not null default now()
)`,
      ...NOMBRES_TABLAS.map(
        (t) => `create table if not exists ${tablaSql(t)} (
  school_id text not null references "escuelas" (school_id) on delete cascade,
  id text not null,
  orden bigint generated always as identity,
  data jsonb not null,
  actualizado timestamptz not null default now(),
  primary key (school_id, id)
)`,
      ),
      ...TODAS.flatMap(rls),
    ],
  },
  {
    version: 2,
    nombre: 'Función edugrid_exigir para cancelar un lote si un registro no existe',
    sql: [
      `create or replace function edugrid_exigir(n bigint, mensaje text) returns void language plpgsql as $$
begin
  if n = 0 then
    raise exception using errcode = 'P0002', message = mensaje;
  end if;
end $$`,
    ],
  },
  {
    version: 3,
    nombre: 'Cuentas reales: escuelas con prueba de 30 días, usuarios, perfiles, invitaciones y sesiones',
    sql: [
      // Solo se agregan columnas: la escuela demo y todo lo del Mensaje 9 sigue igual.
      // El id de la escuela es school_id y su fecha de alta, «creada» (created_at la repite).
      `alter table "escuelas"
  add column if not exists nombre text,
  add column if not exists niveles text[] not null default '{}',
  add column if not exists marca jsonb,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists created_at timestamptz generated always as (creada) stored`,
      // Una cuenta por correo en cada escuela. La contraseña solo se guarda como hash (scrypt) y la pone la persona.
      `create table if not exists "usuarios" (
  school_id text not null references "escuelas" (school_id) on delete cascade,
  id text not null,
  correo text not null check (correo = lower(correo)),
  hash_contrasena text,
  nombre text not null,
  estado text not null default 'invitado' check (estado in ('invitado', 'activo')),
  created_at timestamptz not null default now(),
  primary key (school_id, id),
  unique (school_id, correo)
)`,
      // Una cuenta puede tener varios perfiles (por ejemplo docente y familia). Cada perfil apunta a su ficha.
      `create table if not exists "perfiles" (
  school_id text not null,
  id text not null,
  usuario_id text not null,
  tipo text not null check (tipo in ('administrador', 'docente', 'familia', 'alumno')),
  personal_id text,
  docente_id text,
  alumno_id text,
  tutor_id text,
  created_at timestamptz not null default now(),
  primary key (school_id, id),
  foreign key (school_id, usuario_id) references "usuarios" (school_id, id) on delete cascade,
  check (num_nonnulls(personal_id, docente_id, alumno_id, tutor_id) = 1)
)`,
      `create unique index if not exists perfiles_unico on "perfiles" (school_id, usuario_id, tipo, coalesce(personal_id, docente_id, alumno_id, tutor_id))`,
      // Del token solo se guarda su huella (sha-256): quien lea la base no puede usar las ligas.
      `create table if not exists "invitaciones" (
  school_id text not null references "escuelas" (school_id) on delete cascade,
  id text not null,
  correo text not null,
  nombre text not null,
  tipo text not null check (tipo in ('administrador', 'docente', 'familia', 'alumno')),
  personal_id text,
  docente_id text,
  alumno_id text,
  tutor_id text,
  token text not null unique,
  expira_at timestamptz not null,
  usada_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (school_id, id)
)`,
      `create table if not exists "sesiones" (
  school_id text not null,
  id text not null,
  usuario_id text not null,
  perfil_id text,
  token text not null unique,
  expira_at timestamptz not null,
  cerrada_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (school_id, id),
  foreign key (school_id, usuario_id) references "usuarios" (school_id, id) on delete cascade
)`,
      `create table if not exists "recuperaciones" (
  school_id text not null,
  id text not null,
  usuario_id text not null,
  token text not null unique,
  expira_at timestamptz not null,
  usada_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (school_id, id),
  foreign key (school_id, usuario_id) references "usuarios" (school_id, id) on delete cascade
)`,
      ...TABLAS_CUENTAS.flatMap(rls),
      // Para iniciar sesión solo con correo y contraseña: la transacción fija `edugrid.correo`
      // y ve únicamente las cuentas con ESE correo (y sus escuelas), nada más.
      `drop policy if exists por_correo on "usuarios"`,
      `create policy por_correo on "usuarios" for select
  using (correo = current_setting('edugrid.correo', true))`,
      `drop policy if exists por_correo on "escuelas"`,
      `create policy por_correo on "escuelas" for select
  using (school_id in (select u.school_id from "usuarios" u where u.correo = current_setting('edugrid.correo', true)))`,
    ],
  },
  {
    version: 4,
    nombre: 'Una invitación por correo: perfiles adicionales dentro de la misma invitación',
    sql: [
      // Si un correo ya tiene invitación pendiente (por ejemplo, la mamá como familia),
      // los demás perfiles para ese correo (sus hijos como alumnos) se agregan aquí: [{tipo, ref}].
      `alter table "invitaciones" add column if not exists extra jsonb not null default '[]'::jsonb`,
      `create index if not exists invitaciones_correo on "invitaciones" (school_id, correo)`,
    ],
  },
]

const CREAR_CONTROL = `create table if not exists "edugrid_migraciones" (
  version integer primary key,
  nombre text not null,
  aplicada timestamptz not null default now()
)`

/**
 * Crea el rol edugrid_app y le da permiso sobre las tablas. Si el usuario de la
 * base no puede crear roles, no falla: el aislamiento queda a cargo del filtro
 * por school_id que llevan todas las consultas (y de RLS si el rol no lo omite).
 */
const PERMISOS = `do $$
begin
  if not exists (select 1 from pg_roles where rolname = '${ROL_APP}') then
    create role ${ROL_APP} nologin;
  end if;
  grant usage on schema public to ${ROL_APP};
  grant select, insert, update, delete on all tables in schema public to ${ROL_APP};
  grant usage, select on all sequences in schema public to ${ROL_APP};
  if not pg_has_role(current_user, '${ROL_APP}', 'SET') then
    execute format('grant %I to %I', '${ROL_APP}', current_user);
  end if;
exception when others then
  raise notice 'EDUGRID: no se pudo preparar el rol ${ROL_APP}: %', sqlerrm;
end $$`

const PUEDE_ROL = `case when exists (select 1 from pg_roles where rolname = '${ROL_APP}') then pg_has_role(current_user, '${ROL_APP}', 'SET') else false end`

/**
 * Prepara la base y dice si las consultas pueden usar el rol edugrid_app.
 * Camino rápido (lo normal en cada arranque del servidor): una sola consulta
 * confirma que no falta ninguna migración. Si falta algo, aplica lo que falte.
 */
export async function prepararEsquema(db: Ejecutor): Promise<{ aplicadas: number[]; puedeUsarRol: boolean }> {
  const ultima = MIGRACIONES.at(-1)?.version ?? 0
  try {
    const [f] = await db.consulta(`select coalesce(max(version), 0)::int as v, count(*)::int as n, ${PUEDE_ROL} as puede from "edugrid_migraciones"`)
    if (Number(f?.v) === ultima && Number(f?.n) === MIGRACIONES.length) return { aplicadas: [], puedeUsarRol: f?.puede === true }
  } catch {
    // La tabla de control todavía no existe: base nueva.
  }
  const aplicadas = await migrar(db)
  return { aplicadas, puedeUsarRol: await puedeUsarRol(db) }
}

/** Aplica las migraciones que falten. Se puede llamar muchas veces sin problema. */
export async function migrar(db: Ejecutor): Promise<number[]> {
  await db.consulta(CREAR_CONTROL)
  const hechas = new Set((await db.consulta('select version from "edugrid_migraciones"')).map((r) => Number(r.version)))
  const aplicadas: number[] = []
  for (const m of MIGRACIONES) {
    if (hechas.has(m.version)) continue
    const consultas: Consulta[] = [
      ...m.sql.map((text) => ({ text })),
      { text: 'insert into "edugrid_migraciones" (version, nombre) values ($1, $2) on conflict (version) do nothing', params: [m.version, m.nombre] },
    ]
    await db.transaccion(consultas)
    aplicadas.push(m.version)
  }
  // Los permisos se repasan después de migrar, así cubren también las tablas nuevas.
  await db.consulta(PERMISOS)
  return aplicadas
}

/** ¿Puede este usuario cambiarse al rol edugrid_app? Entonces RLS se aplica aunque sea dueño de las tablas. */
export async function puedeUsarRol(db: Ejecutor): Promise<boolean> {
  const [fila] = await db.consulta(
    `select ${PUEDE_ROL} as puede`,
  )
  return fila?.puede === true
}
