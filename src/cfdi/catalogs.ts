// Extracto de catálogos del SAT para CFDI 4.0 usados por EDUGRID.
export const REGIMENES: Record<string, string> = {
  '601': 'General de Ley Personas Morales',
  '603': 'Personas Morales con Fines no Lucrativos',
  '605': 'Sueldos y Salarios e Ingresos Asimilados a Salarios',
  '606': 'Arrendamiento',
  '612': 'Personas Físicas con Actividades Empresariales y Profesionales',
  '616': 'Sin obligaciones fiscales',
  '626': 'Régimen Simplificado de Confianza',
}

export const USOS_CFDI: Record<string, string> = {
  D10: 'Pagos por servicios educativos (colegiaturas)',
  G03: 'Gastos en general',
  S01: 'Sin efectos fiscales',
}

export const FORMAS_PAGO: Record<string, string> = {
  '01': 'Efectivo',
  '03': 'Transferencia electrónica de fondos',
  '04': 'Tarjeta de crédito',
  '28': 'Tarjeta de débito',
}

export const MOTIVOS_CANCELACION: Record<string, string> = {
  '01': 'Comprobante emitido con errores con relación',
  '02': 'Comprobante emitido con errores sin relación',
  '03': 'No se llevó a cabo la operación',
  '04': 'Operación nominativa relacionada en una factura global',
}

export const RFC_PUBLICO_GENERAL = 'XAXX010101000'
/** RFC ficticio de la demo (no corresponde a ningún contribuyente). */
export const RFC_DEMO_RE = /^DEMO\d{6}[A-Z\d]{3}$/
export const RFC_RE = /^([A-ZÑ&]{3,4})(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([A-Z\d]{2})([A\d])$/

export const NIVEL_IEDU: Record<string, string> = {
  kinder: 'Preescolar',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
  preparatoria: 'Bachillerato o su equivalente',
}
