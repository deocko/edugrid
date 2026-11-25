import type { Consulta, Ejecutor } from './db.js'
import { NOMBRES_TABLAS, tablaSql } from './tablas.js'

/** Rol sin privilegios especiales con el que corren las consultas de datos, para que Postgres aplique RLS. */
export const ROL_APP = 'edugrid_app'

const TODAS = ['"escuelas"', ...NOMBRES_TABLAS.map(tablaSql)]

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
    const [f] = await db.consulta(`select coalesce(max(version), 0)::int as v, ${PUEDE_ROL} as puede from "edugrid_migraciones"`)
    if (Number(f?.v) === ultima) return { aplicadas: [], puedeUsarRol: f?.puede === true }
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
