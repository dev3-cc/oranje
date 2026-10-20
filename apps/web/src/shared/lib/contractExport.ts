import {
  EXHIBIT_HEADER,
  PROVIDER,
  PROVIDER_ADDRESS,
  type DocumentRate,
  type DocumentTerms,
} from '../components/ContractDocument'

import { CONTRACT_CLAUSES } from './contractClauses'
import { formatMoney } from './formatters'

/**
 * El acuerdo de servicio (`ContractDocument`) en PDF y Word — mismo patrón
 * que `proposalDocument.ts`: el contenido fijo (`CONTRACT_CLAUSES`,
 * `EXHIBIT_HEADER`) es el MISMO array que ya pinta la pantalla, para que el
 * archivo nunca diverja de lo que se ve (es un documento legal — la
 * duplicación aquí sería un riesgo real, no solo repetición).
 */
export interface ContractExportInput {
  hotelName: string
  hotelAddress: string | null
  rates: DocumentRate[]
  servicesNote?: string | null
  startDate: string
  endDate: string | null
  terms?: DocumentTerms | null
}

function usDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${month ?? ''}/${day ?? ''}/${year ?? ''}`
}

function oneYearLater(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const end = new Date((year ?? 0) + 1, (month ?? 1) - 1, (day ?? 1) - 1)
  return `${String(end.getFullYear())}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
}

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

export async function buildContractPdf(input: ContractExportInput) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 56
  const contentWidth = pageWidth - margin * 2
  const ink = '#1A1108'
  const ink2 = '#4A3F35'
  const ink3 = '#8A7A6A'
  let y = margin

  const fill = (text: string): string =>
    text
      .replace('{startDate}', usDate(input.startDate))
      .replace('{endDate}', usDate(input.endDate ?? oneYearLater(input.startDate)))
      .replace('{provider}', PROVIDER)

  function ensureRoom(lines: number, lineHeight = 13): void {
    if (y + lines * lineHeight > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  function paragraph(text: string, { bold = false, size = 9.5, color = ink2 } = {}): void {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(color)
    const lines = doc.splitTextToSize(text, contentWidth) as string[]
    ensureRoom(lines.length)
    doc.text(lines, margin, y)
    y += lines.length * (size * 1.35) + 4
  }

  // Encabezado
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(ink)
  doc.text('SERVICE AGREEMENT', pageWidth / 2, y, { align: 'center' })
  y += 26

  paragraph(
    `This Service Agreement ("Agreement") is between ${PROVIDER}, a Georgia limited liability ` +
      `company, ${PROVIDER_ADDRESS} ("Service Provider"), and ${input.hotelName}` +
      `${input.hotelAddress ? `, ${input.hotelAddress}` : ''} ("Company").`,
  )
  paragraph(
    'WHEREAS, Company desires to engage Service Provider to provide staffing and related services, ' +
      'and Service Provider agrees to provide such services under the following terms.',
  )

  for (const clause of CONTRACT_CLAUSES) {
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(ink)
    ensureRoom(2)
    doc.text(`${clause.title}.`, margin, y)
    y += 14
    for (const para of clause.paragraphs) paragraph(fill(para))
  }

  // Firmas (sin firmar a propósito — se firma fuera del sistema)
  ensureRoom(8, 20)
  y += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(ink)
  doc.text('SIGNATURES', margin, y)
  y += 22
  for (const [party, label] of [
    [PROVIDER, 'Service Provider'],
    [input.hotelName, 'Company'],
  ] as const) {
    doc.setFont('helvetica', 'bold')
    doc.text(`${party} (${label})`, margin, y)
    y += 18
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(ink3)
    doc.text('By: ______________________________  Date: ____________', margin, y)
    y += 14
    doc.text('Name/Title: ______________________________', margin, y)
    y += 24
  }

  // Exhibit "A"
  doc.addPage()
  y = margin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(ink)
  doc.text('EXHIBIT "A" - RATES AND STAFFING TERMS', pageWidth / 2, y, { align: 'center' })
  y += 22
  paragraph(EXHIBIT_HEADER, { size: 8.5, color: ink3 })
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(ink)
  doc.text(input.hotelName, pageWidth / 2, y, { align: 'center' })
  y += 24

  doc.setFontSize(9.5)
  doc.text('Position', margin, y)
  doc.text('Hourly Pay Rate', margin + contentWidth * 0.55, y, { align: 'right' })
  doc.text('Hourly Bill Rate', pageWidth - margin, y, { align: 'right' })
  y += 6
  doc.setDrawColor(ink3)
  doc.line(margin, y, pageWidth - margin, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(ink2)
  for (const rate of input.rates) {
    ensureRoom(1)
    doc.text(rate.positionName, margin, y)
    doc.text(formatMoney(rate.payRate), margin + contentWidth * 0.55, y, { align: 'right' })
    doc.text(formatMoney(rate.billRate), pageWidth - margin, y, { align: 'right' })
    y += 15
  }

  if (input.terms) {
    y += 8
    paragraph(
      `Overtime: billed in accordance with Section 5 — ${input.terms.overtime.bill.toFixed(2)}x bill rate ` +
        `and ${input.terms.overtime.pay.toFixed(2)}x pay rate. Holidays: ${input.terms.holiday.bill.toFixed(2)}x bill rate ` +
        `and ${input.terms.holiday.pay.toFixed(2)}x pay rate.`,
      { size: 8.5, color: ink3 },
    )
  }
  if (input.servicesNote) {
    paragraph(`Scope of services: ${input.servicesNote}`, { size: 8.5, color: ink3 })
  }

  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(ink)
  doc.text('I AGREE TO THE RATES AND TERMS IN THIS EXHIBIT "A"', pageWidth / 2, y, {
    align: 'center',
  })
  y += 26
  for (const label of ['Company Representative', 'Service Provider Representative']) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(`${label}:`, margin, y)
    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(ink3)
    doc.text('Name & Signature: ______________________________  Date: __________', margin, y)
    y += 22
  }

  return { doc, filename: `contrato-${slugify(input.hotelName)}.pdf` }
}

export async function downloadContractPdf(input: ContractExportInput): Promise<void> {
  const { doc, filename } = await buildContractPdf(input)
  doc.save(filename)
}

export async function contractPdfBlob(input: ContractExportInput): Promise<Blob> {
  const { doc } = await buildContractPdf(input)
  return doc.output('blob')
}

/** El mismo documento en `.docx` — mismo motivo que la Propuesta: alguien del
    hotel lo revisa o lo pasa a su propia plantilla antes de firmar. */
export async function downloadContractDocx(input: ContractExportInput): Promise<void> {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun, AlignmentType } = await import('docx')

  const fill = (text: string): string =>
    text
      .replace('{startDate}', usDate(input.startDate))
      .replace('{endDate}', usDate(input.endDate ?? oneYearLater(input.startDate)))
      .replace('{provider}', PROVIDER)

  const body = (text: string) =>
    new Paragraph({ spacing: { after: 100 }, children: [new TextRun(text)] })

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'SERVICE AGREEMENT', bold: true })],
          }),
          body(
            `This Service Agreement ("Agreement") is between ${PROVIDER}, a Georgia limited ` +
              `liability company, ${PROVIDER_ADDRESS} ("Service Provider"), and ${input.hotelName}` +
              `${input.hotelAddress ? `, ${input.hotelAddress}` : ''} ("Company").`,
          ),
          ...CONTRACT_CLAUSES.flatMap((clause) => [
            new Paragraph({
              spacing: { before: 200, after: 80 },
              children: [new TextRun({ text: `${clause.title}.`, bold: true })],
            }),
            ...clause.paragraphs.map((para) => body(fill(para))),
          ]),
          new Paragraph({
            spacing: { before: 400 },
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'Exhibit "A" - Rates and Staffing Terms', bold: true })],
          }),
          body(EXHIBIT_HEADER),
          ...input.rates.map(
            (rate) =>
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun(
                    `${rate.positionName} — Pay ${formatMoney(rate.payRate)} / Bill ${formatMoney(rate.billRate)}`,
                  ),
                ],
              }),
          ),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `contrato-${slugify(input.hotelName)}.docx`
  link.click()
  URL.revokeObjectURL(url)
}
