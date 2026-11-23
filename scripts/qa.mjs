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
  docente: { role: 'docente', personId: 't14', name: 'Docente demo' },
  familia: { role: 'familia', personId: 'tu0', name: 'Laura Ortega Salinas' },
  alumnoPrim: { role: 'alumno', personId: 'al1', name: 'Alumno primaria' },
  alumnoSec: { role: 'alumno', personId: 'al2', name: 'Alumno secundaria' },
}
const routes = {
  login: ['/'],
  admin: ['/admin', '/admin/alumnos', '/admin/alumnos?alta=1', '/alumnos/al1', '/admin/docentes', '/admin/escuela', '/admin/permisos', '/admin/bitacora', '/avisos', '/pagos', '/pagos?registrar=1&alumno=al2', '/pagos?vista=cargos', '/pagos?vista=conceptos', '/pagos/estado/al2', '/facturacion', '/facturacion/configuracion', '/docente/calificaciones'],
  docente: ['/docente', '/docente/asistencia', '/docente/calificaciones', '/docente/tareas', '/docente/horario', '/avisos'],
  familia: ['/familia', '/familia/hijo/al1', '/familia/pagos', '/familia/calendario', '/avisos', '/pagos/estado/al2', '/privacidad'],
  alumnoPrim: ['/alumno', '/alumno/horario', '/alumno/tareas', '/alumno/calificaciones'],
  alumnoSec: ['/alumno', '/alumno/calificaciones', '/avisos'],
}
// Accesos que deben bloquearse
const denied = [
  ['familia', '/familia/hijo/al3'],
  ['familia', '/pagos/estado/al3'],
  ['familia', '/admin'],
  ['docente', '/alumnos/al3'],
  ['docente', '/pagos'],
  ['alumnoSec', '/familia/hijo/al1'],
  ['alumnoSec', '/facturacion'],
]

const widths = [390, 768, 1024, 1440]
const themes = ['claro', 'oscuro']
const problems = []
const browser = await chromium.launch()

async function open(sessionKey, theme, width, path) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme === 'oscuro' ? 'dark' : 'light' })
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
