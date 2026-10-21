/**
 * Descarga una tabla como CSV que Excel abre bien: cada celda entre comillas,
 * renglones con `\r\n` y el BOM al frente, sin el cual los acentos salen rotos.
 * Mismo formato que la factura de Contabilidad (`invoiceDocument.ts`).
 */
export function downloadCsv(
  fileName: string,
  rows: ReadonlyArray<ReadonlyArray<string | number>>,
): void {
  const cell = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`
  const csv = rows.map((row) => row.map(cell).join(',')).join('\r\n')
  const BOM = '﻿'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

/** `2026-10-21`: la fecha de hoy para el nombre del archivo, en la zona de quien descarga. */
export function todayForFileName(): string {
  const now = new Date()
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
