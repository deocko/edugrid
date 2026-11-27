// Boleta de calificaciones en PDF (DEMO, sin validez oficial ante la SEP).
import type { Database } from '../data/types'
import { formatDate, todayISO } from './format'
import { CYAN, NAVY, TEXT, drawBrandHeader, drawDemoWatermark } from './pdfBrand'
import { subjectHex } from './subjects'
import { brandTokens, brandingOf } from './branding'
import { averageFor, formatAverage, formatScore, groupLabel, homeroomName, isPreschool, levelOfGroup, studentName, subjectName } from './scope'
import { attendanceSummary } from './attendance'

export async function buildReportCardPdf(db: Database, studentId: string): Promise<Blob> {
  const student = db.students.find((s) => s.id === studentId)
  if (!student) throw new Error('Alumno no encontrado')
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const level = levelOfGroup(db, student.groupId)
  const group = db.groups.find((g) => g.id === student.groupId)
  const cycle = db.cycles.find((c) => c.id === group?.cycleId)
  const periods = db.periods.filter((p) => p.cycleId === group?.cycleId)
  const subjects = db.assignments.filter((a) => a.groupId === student.groupId)

  drawDemoWatermark(doc)
  const brand = brandingOf(db.meta)
  drawBrandHeader(doc, brand, brandTokens(brand).nav)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('BOLETA DE CALIFICACIONES', W - 14, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(cycle?.name ?? '', W - 14, 19, { align: 'right' })
  doc.text(db.meta.school.name, W - 14, 24, { align: 'right' })

  doc.setFillColor(253, 241, 220)
  doc.rect(14, 36, W - 28, 10, 'F')
  doc.setTextColor(138, 83, 0)
  doc.setFont('helvetica', 'bold')
  doc.text('DOCUMENTO DEMO · Boleta interna de ejemplo, sin validez oficial ante la SEP', W / 2, 42.5, { align: 'center' })

  doc.setTextColor(...NAVY)
  doc.setFontSize(14)
  doc.text(studentName(student), 14, 56)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT)
  doc.text(`${groupLabel(db, student.groupId)} · Matrícula ${student.enrollmentId} · CURP ${student.curp}`, 14, 62)
  doc.text(`Titular: ${homeroomName(db, group)}`, 14, 67)

  // Tabla
  let y = 76
  const colW = (W - 28 - 70) / periods.length
  doc.setFillColor(...NAVY)
  doc.rect(14, y, W - 28, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('Materia', 16, y + 5.3)
  periods.forEach((p, i) => doc.text(p.name, 84 + colW * i + colW / 2, y + 5.3, { align: 'center' }))
  y += 8
  doc.setFont('helvetica', 'normal')
  subjects.forEach((a, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(243, 246, 250)
      doc.rect(14, y, W - 28, 8, 'F')
    }
    const hex = subjectHex(db, a.subjectId)
    doc.setFillColor(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16))
    doc.rect(14, y, 1.6, 8, 'F')
    doc.circle(18.2, y + 4, 1.3, 'F')
    doc.setTextColor(...TEXT)
    doc.text(subjectName(db, a.subjectId), 21, y + 5.3)
    periods.forEach((p, i) => {
      const r = db.gradeRecords.find((g) => g.studentId === student.id && g.subjectId === a.subjectId && g.periodId === p.id)
      const closed = db.closures.some((c) => c.groupId === student.groupId && c.subjectId === a.subjectId && c.periodId === p.id)
      const label = r ? `${formatScore(level, r.score)}${closed ? '' : ' *'}` : '—'
      doc.text(label, 84 + colW * i + colW / 2, y + 5.3, { align: 'center' })
    })
    y += 8
  })
  doc.setDrawColor(...CYAN)
  doc.setLineWidth(0.6)
  doc.line(14, y, W - 14, y)
  y += 7
  if (!isPreschool(level)) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text('Promedio', 16, y)
    periods.forEach((p, i) => {
      const avg = averageFor(db, student.id, p.id)
      doc.text(formatAverage(avg), 84 + colW * i + colW / 2, y, { align: 'center' })
    })
    y += 8
  }
  const att = attendanceSummary(db, student.id)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TEXT)
  doc.text(`Asistencia registrada en el ciclo: ${att.rate}% · Retardos: ${att.retardo} · Faltas: ${att.falta} · Justificadas: ${att.justificada}`, 14, y + 2)
  doc.setFontSize(7.5)
  doc.text(isPreschool(level) ? 'Preescolar: se evalúan niveles de logro (Requiere apoyo, En proceso, Logrado, Destacado).' : 'Escala de 5 a 10. Calificación mínima aprobatoria: 6.', 14, y + 8)
  doc.text('* Calificación preliminar: el periodo aún no se cierra.', 14, y + 12)

  // Firmas
  const sy = H - 40
  doc.setDrawColor(...TEXT)
  doc.setLineWidth(0.3)
  doc.line(25, sy, 85, sy)
  doc.line(W - 85, sy, W - 25, sy)
  doc.setFontSize(8)
  doc.text('Dirección', 55, sy + 5, { align: 'center' })
  doc.text('Madre, padre o tutor', W - 55, sy + 5, { align: 'center' })
  doc.setFontSize(7)
  doc.text(`Generado el ${formatDate(todayISO())} por EDUGRID · ${db.meta.school.name} (escuela ficticia, datos DEMO).`, 14, H - 12)
  return doc.output('blob')
}
