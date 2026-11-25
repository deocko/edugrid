// QA visual y de accesibilidad: recorre la app con cada rol en 390/768/1024/1440 px,
// en modo claro y oscuro. Revisa desbordes horizontales, contraste (axe-core),
// errores de consola y la matriz de permisos.
// Uso: npm run build && npx vite preview --port 4173 &  luego  node scripts/qa.mjs
// Requiere Playwright instalado (npm i -D playwright o global con NODE_PATH).
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

const BASE = process.env.QA_URL ?? 'http://localhost:4173/edugrid/'
const OUT = process.env.QA_OUT ?? 'qa-output'
const SHOTS = process.env.QA_SHOTS === '1'
mkdirSync(OUT, { recursive: true })

const sessions = {
  admin: { role: 'admin', personId: 'adm1', name: 'Mtra. Patricia Ruiz' },
  docente: { role: 'docente', personId: 't14', name: 'Carmen Escobedo Salinas' },
  familia: { role: 'familia', personId: 'tu0', name: 'Laura Ortega Salinas' },
  alumnoPrim: { role: 'alumno', personId: 'al1', name: 'Alumno primaria' },
  alumnoSec: { role: 'alumno', personId: 'al41', name: 'Alumno secundaria' },
}
const routes = {
  login: ['/'],
  admin: ['/admin', '/admin/alumnos', '/admin/alumnos?alta=1', '/alumnos/al1', '/admin/docentes', '/admin/escuela', '/admin/permisos', '/admin/bitacora', '/avisos', '/pagos', '/pagos?registrar=1&alumno=al2', '/pagos?vista=cargos', '/pagos?vista=conceptos', '/pagos/estado/al2', '/facturacion', '/facturacion/configuracion', '/docente/calificaciones', '/admin/entradas', '/admin/familias', '/admin/aulas', '/admin/clases', '/notificaciones', '/admin/configuracion', '/admin/calificaciones', '/admin/calendario', '/admin/ajustes', '/docente/asistencia?grupo=gr-primaria-4A', '/perfil'],
  docente: ['/mas', '/perfil', '/docente', '/docente/asistencia', '/docente/calificaciones', '/docente/tareas', '/docente/horario', '/avisos', '/docente/entradas', '/docente/novedades', '/docente/chat', '/docente/chat?c=ch1'],
  familia: ['/mas', '/perfil', '/familia', '/familia/hijo/al1', '/familia/hijo/al1?vista=dia', '/familia/pagos', '/familia/calendario', '/avisos', '/pagos/estado/al2', '/privacidad', '/familia/qr', '/familia/chat', '/familia/chat?c=ch1', '/notificaciones', '/familia/tarjetas'],
  alumnoPrim: ['/mas', '/perfil', '/alumno', '/alumno/horario', '/alumno/tareas', '/alumno/calificaciones', '/alumno/qr'],
  alumnoSec: ['/alumno', '/alumno/calificaciones', '/avisos'],
}
// Accesos que deben bloquearse
const denied = [
  ['familia', '/familia/hijo/al3'],
  ['familia', '/pagos/estado/al3'],
  ['familia', '/admin'],
  ['docente', '/admin/configuracion'],
  ['docente', '/familia/tarjetas'],
  ['docente', '/alumnos/al3'],
  ['docente', '/pagos'],
  ['alumnoSec', '/familia/hijo/al1'],
  ['alumnoSec', '/facturacion'],
  ['familia', '/admin/familias'],
  ['familia', '/docente/entradas'],
  ['docente', '/admin/entradas'],
  ['alumnoSec', '/familia/chat'],
]

// Errores de redacción que no deben aparecer en ninguna vista
const TEXT_RULES = [
  [/\d(alumnos?|grupos?|hijos?|materias?|docentes?|tareas?|pagos?|cargos?|avisos?)\b/i, 'número pegado a la palabra'],
  [/\b1 (alumnos|grupos|hijos|materias|docentes|tareas|pagos|cargos|avisos|faltas|retardos|días)\b/, 'plural con 1'],
  [/\bArte\b/, '«Arte» en lugar de «Artes»'],
  [/Entrar como Papá/, 'debe decir «Entrar como Familia»'],
  [/Cambiar a modo/, 'texto del tema sin simplificar'],
]
if (process.env.QA_ROUTES_4A) TEXT_RULES.push([/ecuaciones lineales|carta formal/i, 'tarea de secundaria en primaria'])

const widths = [390, 768, 1024, 1440]
const themes = ['claro', 'oscuro']
const problems = []
const browser = await chromium.launch()

// QA_MARCA=arboleda|montesol revisa todo con la marca de una escuela de ejemplo aplicada.
let storageState
if (process.env.QA_MARCA) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.addInitScript((s) => localStorage.setItem('edugrid.demo.sesion', s), JSON.stringify(sessions.admin))
  await page.goto(`${BASE}#/admin/configuracion`)
  const names = { arboleda: /Colegio Arboleda/, montesol: /Instituto Montesol/ }
  await page.getByRole('button', { name: names[process.env.QA_MARCA] }).click()
  await page.getByText('En uso').waitFor()
  storageState = await ctx.storageState()
  await ctx.close()
  console.log(`Marca aplicada: ${process.env.QA_MARCA}`)
}

async function open(sessionKey, theme, width, path) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme === 'oscuro' ? 'dark' : 'light', storageState })
  await ctx.addInitScript(([s, t]) => {
    if (s) localStorage.setItem('edugrid.demo.sesion', s)
    else localStorage.removeItem('edugrid.demo.sesion')
    localStorage.setItem('edugrid.tema', t)
  }, [sessionKey === 'login' ? '' : JSON.stringify(sessions[sessionKey]), theme])
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(`${BASE}#${path}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(150)
  return { ctx, page, errors }
}

let checked = 0
for (const theme of themes) {
  for (const width of widths) {
    for (const [who, list] of Object.entries(routes)) {
      for (const path of list) {
        if (process.env.QA_FILTER && !path.includes(process.env.QA_FILTER)) continue
        const { ctx, page, errors } = await open(who, theme, width, path)
        const tag = `${theme} ${width}px ${who} ${path}`
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        if (overflow > 0) problems.push(`${tag}: desborde horizontal de ${overflow}px`)
        const cut = await page.evaluate(() => {
          const out = []
          for (const el of document.querySelectorAll('h1,h2,h3,p,span,a,button,label,td,th,dd,dt,li')) {
            const cs = getComputedStyle(el)
            if (cs.textOverflow === 'ellipsis' || el.closest('.sr-only') || el.classList.contains('sr-only') || el.closest('.overflow-x-auto') || el.closest('[role=tablist]')) continue
            if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible' && el.clientWidth > 0) out.push(`${el.tagName} "${el.textContent.trim().slice(0, 40)}"`)
          }
          return out.slice(0, 5)
        })
        for (const c of cut) problems.push(`${tag}: texto cortado ${c}`)
        // Tablas que no caben y obligan a desplazar horizontalmente
        const wide = await page.evaluate(() => [...document.querySelectorAll('table')].filter((t) => t.offsetParent && t.scrollWidth > (t.parentElement?.clientWidth ?? 0) + 1).map((t) => `${t.scrollWidth}px en ${t.parentElement?.clientWidth}px: ${t.querySelector('th')?.textContent ?? ''}`))
        for (const w of wide) problems.push(`${tag}: tabla con desplazamiento horizontal ${w}`)
        // Redacción: texto visible y árbol de accesibilidad
        if (theme === 'claro' && width === 1440) {
          const visible = await page.innerText('body')
          const aria = await page.locator('body').ariaSnapshot()
          for (const [label, src] of [['texto', visible], ['accesibilidad', aria]]) {
            for (const [re, why] of TEXT_RULES) {
              const m = src.match(re)
              if (m) problems.push(`${tag}: ${why} en ${label}: «${m[0]}»`)
            }
          }
        }
        await page.addScriptTag({ content: axeSource })
        const axe = await page.evaluate(async () => {
          const r = await window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast', 'label', 'button-name', 'link-name', 'image-alt', 'html-has-lang', 'duplicate-id-aria'] } })
          return r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' ' + (n.any[0]?.message ?? '')).join(' | ')}`)
        })
        for (const a of axe) problems.push(`${tag}: ${a}`)
        for (const e of errors) problems.push(`${tag}: consola: ${e}`)
        if (SHOTS && (width === 390 || width === 1440)) await page.screenshot({ path: `${OUT}/${theme}-${width}-${who}${path.replace(/[/?=&]/g, '_')}.png`, fullPage: true })
        checked++
        await ctx.close()
      }
    }
  }
}

for (const [who, path] of denied) {
  const { ctx, page } = await open(who, 'claro', 390, path)
  const text = await page.textContent('body')
  if (!text.includes('No tienes acceso')) problems.push(`PERMISOS: ${who} pudo abrir ${path}`)
  await ctx.close()
  checked++
}

await browser.close()
writeFileSync(`${OUT}/reporte.txt`, problems.join('\n') + '\n')
console.log(`Pantallas revisadas: ${checked}. Problemas: ${problems.length}`)
for (const p of problems.slice(0, 80)) console.log(' - ' + p)
process.exit(problems.length ? 1 : 0)
