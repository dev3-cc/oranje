import { PROVIDER, PROVIDER_ADDRESS } from '@/shared/components/ContractDocument'
import { formatMoney, formatWeekRange } from '@/shared/lib/formatters'

/** Un renglón del cuadro: lo que recibe el colaborador y lo que se le cobra
    al hotel por la misma hoja. `null` cuando esa tarifa no está resuelta —
    la celda queda en «—», nunca un número inventado. */
export interface InvoiceLineItem {
  workerName: string
  regularHours: number
  overtimeHours: number
  payRate: number | null
  billRate: number | null
  paySubtotal: number | null
  billSubtotal: number | null
}

export interface InvoiceInput {
  hotelName: string
  hotelAddress: string | null
  weekStart: string
  weekEnd: string
  items: InvoiceLineItem[]
}

/** `hotel-cartersville` desde «Home2 Suites by Hilton Cartersville». */
function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'hotel'
  )
}

function money(amount: number | null): string {
  return amount === null ? '—' : formatMoney(amount)
}

function todayUs(): string {
  const now = new Date()
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${String(now.getFullYear())}`
}

/**
 * El Excel que Contabilidad descarga, página 1 y 2 del machote que trajo
 * Hugo (2026-10-14) — portada con el total y las condiciones, tal cual, SIN
 * la sección de remesa/wire: eso exige datos bancarios reales que todavía no
 * tenemos, y no se inventan (Hugo, 2026-10-14: "quita el remesa/wire de este
 * archivo"). CSV y no un `.xlsx` con estilo: abre en Excel igual, sin sumar
 * una librería nueva solo por esto.
 */
export function downloadInvoiceCsv(input: InvoiceInput): void {
  const totalPay = input.items.reduce((sum, item) => sum + (item.paySubtotal ?? 0), 0)
  const totalBill = input.items.reduce((sum, item) => sum + (item.billSubtotal ?? 0), 0)
  const period = formatWeekRange(input.weekStart, input.weekEnd)

  const cell = (value: string): string => `"${value.replace(/"/g, '""')}"`
  const rows: string[][] = [
    [PROVIDER],
    [PROVIDER_ADDRESS],
    [''],
    ['Invoice for', input.hotelName],
    ...(input.hotelAddress ? [['', input.hotelAddress]] : []),
    ['Invoice Date', todayUs()],
    ['Pay period', period],
    [''],
    [
      'Worker',
      'Regular hours',
      'Overtime hours',
      'Pay rate',
      'Bill rate',
      'Pay subtotal',
      'Bill subtotal',
    ],
    ...input.items.map((item) => [
      item.workerName,
      item.regularHours.toFixed(2),
      item.overtimeHours.toFixed(2),
      money(item.payRate),
      money(item.billRate),
      money(item.paySubtotal),
      money(item.billSubtotal),
    ]),
    [''],
    ['', '', '', '', 'Total pay', formatMoney(totalPay)],
    ['', '', '', '', 'Total bill', formatMoney(totalBill)],
    [''],
    ['The general terms and conditions of purchase are specified on the contract.'],
    ['Any adjustments please let us know before processing week.'],
    ['Holidays and days off should be noticed by our accounting department.'],
  ]

  const csv = rows.map((row) => row.map(cell).join(',')).join('\r\n')
  // BOM al frente: sin él, Excel abre los acentos del nombre rotos.
  const BOM = '﻿'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `invoice-${slugify(input.hotelName)}-${input.weekStart}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/** El mismo documento, en PDF — mismo `jsPDF` que ya usa el QR de ponche
    (`HotelPunchQrPrintPage`), sin sumar otra librería. */
export async function downloadInvoicePdf(input: InvoiceInput): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 56
  const ink = '#1A1108'
  const ink3 = '#8A7A6A'
  let y = 64

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(ink)
  doc.text(PROVIDER, margin, y)
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(ink3)
  doc.text(PROVIDER_ADDRESS, margin, y)
  y += 36

  doc.setFontSize(10)
  doc.setTextColor(ink)
  doc.text(`Invoice Date: ${todayUs()}`, margin, y)
  y += 20
  doc.text('Invoice for:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(input.hotelName, margin + 90, y)
  doc.setFont('helvetica', 'normal')
  y += 16
  if (input.hotelAddress) {
    doc.text(input.hotelAddress, margin + 90, y)
    y += 16
  }
  doc.text(`Pay period: ${formatWeekRange(input.weekStart, input.weekEnd)}`, margin, y)
  y += 32

  const columns = [
    { label: 'Worker', width: 150 },
    { label: 'Reg. h', width: 50 },
    { label: 'OT h', width: 50 },
    { label: 'Pay rate', width: 65 },
    { label: 'Bill rate', width: 65 },
    { label: 'Pay $', width: 70 },
    { label: 'Bill $', width: 70 },
  ]
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0)

  function row(values: string[], bold: boolean): void {
    let x = margin
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    for (const [index, column] of columns.entries()) {
      doc.text(values[index] ?? '', x, y, { maxWidth: column.width - 4 })
      x += column.width
    }
    y += 16
  }

  doc.setFontSize(9)
  doc.setDrawColor(ink3)
  doc.line(margin, y - 4, margin + tableWidth, y - 4)
  row(
    columns.map((c) => c.label),
    true,
  )
  doc.line(margin, y - 4, margin + tableWidth, y - 4)

  let totalPay = 0
  let totalBill = 0
  for (const item of input.items) {
    totalPay += item.paySubtotal ?? 0
    totalBill += item.billSubtotal ?? 0
    if (y > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage()
      y = 64
    }
    row(
      [
        item.workerName,
        item.regularHours.toFixed(2),
        item.overtimeHours.toFixed(2),
        money(item.payRate),
        money(item.billRate),
        money(item.paySubtotal),
        money(item.billSubtotal),
      ],
      false,
    )
  }

  doc.line(margin, y - 4, margin + tableWidth, y - 4)
  y += 12
  doc.setFont('helvetica', 'bold')
  doc.text(`Total pay: ${formatMoney(totalPay)}`, margin + tableWidth - 180, y)
  y += 16
  doc.text(`Total bill: ${formatMoney(totalBill)}`, margin + tableWidth - 180, y)
  y += 36

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(ink3)
  const terms = [
    'The general terms and conditions of purchase are specified on the contract.',
    'Any adjustments please let us know before processing week.',
    'Holidays and days off should be noticed by our accounting department.',
  ]
  for (const line of terms) {
    doc.text(line, margin, y, { maxWidth: pageWidth - margin * 2 })
    y += 14
  }

  doc.save(`invoice-${slugify(input.hotelName)}-${input.weekStart}.pdf`)
}
