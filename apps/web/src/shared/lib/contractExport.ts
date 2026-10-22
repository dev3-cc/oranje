import {
  exhibitHeader,
  OVERTIME_NOTE,
  PROVIDER,
  PROVIDER_ADDRESS,
  splitClauseMarker,
  type DocumentRate,
} from '../components/ContractDocument'

import { CONTRACT_CLAUSES } from './contractClauses'
import { formatMoney } from './formatters'

import logoOrange from '@/assets/logo/Logo_ORANJE_Orange.png'

/** 4626×429 px real del archivo: todo lo que lo dibuja parte de esta razón. */
const LOGO_ASPECT = 4626 / 429

/** Mismo criterio que `proposalDocument.ts`: una sola descarga por pestaña. */
let logoBytesCache: Promise<ArrayBuffer> | null = null

function logoBytes(): Promise<ArrayBuffer> {
  logoBytesCache ??= fetch(logoOrange).then((response) => response.arrayBuffer())
  return logoBytesCache
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * El acuerdo de servicio (`ContractDocument`) en PDF y Word — mismo patrón
 * que `proposalDocument.ts`: el contenido fijo (`CONTRACT_CLAUSES`,
 * `exhibitHeader`/`OVERTIME_NOTE`) es el MISMO que ya pinta la pantalla, para
 * que el archivo nunca diverja de lo que se ve (es un documento legal — la
 * duplicación aquí sería un riesgo real, no solo repetición).
 */
export interface ContractExportInput {
  hotelName: string
  /** [PROPERTY NAME] del machote; cae en `hotelName` si no hay override. */
  propertyName: string | null
  propertyAddress: string | null
  companyEmail: string | null
  /** Hoy fijos en código (`PROVIDER`/`PROVIDER_ADDRESS`): nulo = usa esos valores. */
  serviceProviderName: string | null
  serviceProviderEmail: string | null
  rates: DocumentRate[]
  servicesNote?: string | null
  startDate: string
  endDate: string | null
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
  const provider = input.serviceProviderName || PROVIDER
  const displayName = input.propertyName || input.hotelName

  const fill = (text: string): string =>
    text
      .replace('{startDate}', usDate(input.startDate))
      .replace('{endDate}', usDate(input.endDate ?? oneYearLater(input.startDate)))
      .replace('{provider}', provider)

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

  /** Un párrafo de cláusula: el `(a)` en negrita, el resto en texto normal,
      con sangría colgante — mismo machote, el original lo deja a ras del
      margen en vez de colgado, pero jsPDF no calcula eso línea por línea. */
  function clauseParagraph(text: string): void {
    const { marker, rest } = splitClauseMarker(text)
    if (!marker) {
      paragraph(text)
      return
    }
    const size = 9.5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(size)
    const markerWidth = doc.getTextWidth(`${marker} `)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(rest, contentWidth - markerWidth) as string[]
    ensureRoom(lines.length)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(ink)
    doc.text(marker, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(ink2)
    doc.text(lines, margin + markerWidth, y)
    y += lines.length * (size * 1.35) + 4
  }

  // Encabezado: el machote real no trae logo — es adición deliberada, igual
  // que la Propuesta (Hugo, 2026-10-21).
  const logoHeight = 20
  const logoWidth = logoHeight * LOGO_ASPECT
  const logoData = arrayBufferToBase64(await logoBytes())
  doc.addImage(logoData, 'PNG', margin, y, logoWidth, logoHeight)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(ink3)
  doc.text('HOSPITALITY STAFFING', pageWidth - margin, y + 8, { align: 'right' })
  y += logoHeight + 10
  doc.setDrawColor(ink3)
  doc.line(margin, y, pageWidth - margin, y)
  y += 26

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(ink)
  doc.text('SERVICE AGREEMENT', pageWidth / 2, y, { align: 'center' })
  y += 26

  paragraph(
    `This Service Agreement ("Agreement") is between ${provider}, a Georgia limited liability ` +
      `company, ${PROVIDER_ADDRESS} ("Service Provider"), and ${displayName}` +
      `${input.propertyAddress ? `, ${input.propertyAddress}` : ''} ("Company").`,
  )
  paragraph(
    'WHEREAS, Company desires to engage Service Provider to provide staffing and related services, ' +
      'and Service Provider agrees to provide such services under the following terms.',
  )

  CONTRACT_CLAUSES.forEach((clause, index) => {
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(ink)
    ensureRoom(2)
    doc.text(`${String(index + 1)}. ${clause.title}`, margin, y)
    y += 14
    for (const para of clause.paragraphs) clauseParagraph(fill(para))
  })

  // Notices — faltaba por completo (Hugo, 2026-10-21): aquí vive el correo.
  ensureRoom(8, 16)
  y += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(ink)
  doc.text('NOTICES', margin, y)
  y += 20
  const noticesColWidth = (contentWidth - 24) / 2
  const noticesStartY = y
  for (const [x, lines] of [
    [
      margin,
      [
        'Service Provider:',
        `${provider},`,
        `${PROVIDER_ADDRESS}.`,
        `Email: ${input.serviceProviderEmail ?? '______________________________'}.`,
      ],
    ],
    [
      margin + noticesColWidth + 24,
      [
        'Company:',
        displayName,
        ...(input.propertyAddress ? [input.propertyAddress] : []),
        `Email: ${input.companyEmail ?? '______________________________'}.`,
      ],
    ],
  ] as const) {
    let colY = noticesStartY
    lines.forEach((line, index) => {
      doc.setFont('helvetica', index === 0 ? 'bold' : 'normal')
      doc.setFontSize(9)
      doc.setTextColor(index === 0 ? ink : ink2)
      const wrapped = doc.splitTextToSize(line, noticesColWidth) as string[]
      doc.text(wrapped, x, colY)
      colY += wrapped.length * 13 + 2
    })
    y = Math.max(y, colY)
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
    [provider, 'Service Provider'],
    [displayName, 'Company'],
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
  doc.text('EXHIBIT "A" - RATES', pageWidth / 2, y, { align: 'center' })
  y += 22
  paragraph(exhibitHeader(provider), { size: 8.5, color: ink3 })
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(ink)
  doc.text(displayName, pageWidth / 2, y, { align: 'center' })
  y += 24

  // Franja negra con texto blanco, igual que el machote real.
  doc.setFillColor(ink)
  doc.rect(margin, y - 12, contentWidth, 20, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor('#FFFFFF')
  doc.text('Position', margin + 6, y)
  doc.text('Regular Hourly Bill Rate', pageWidth - margin - 6, y, { align: 'right' })
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(ink2)
  for (const rate of input.rates) {
    ensureRoom(1)
    doc.text(rate.positionName, margin, y)
    doc.text(formatMoney(rate.billRate), pageWidth - margin, y, { align: 'right' })
    y += 15
  }

  y += 8
  paragraph(OVERTIME_NOTE, { size: 8.5, color: ink3 })
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
  const {
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType,
    ShadingType,
    ImageRun,
    BorderStyle,
  } = await import('docx')

  const provider = input.serviceProviderName || PROVIDER
  const displayName = input.propertyName || input.hotelName

  const fill = (text: string): string =>
    text
      .replace('{startDate}', usDate(input.startDate))
      .replace('{endDate}', usDate(input.endDate ?? oneYearLater(input.startDate)))
      .replace('{provider}', provider)

  const body = (text: string) =>
    new Paragraph({ spacing: { after: 100 }, children: [new TextRun(text)] })

  /** El `(a)` en negrita, el resto normal — Word lo envuelve solo como un
      párrafo: a diferencia de jsPDF, aquí no hace falta calcular el ancho. */
  const clauseParagraph = (text: string) => {
    const { marker, rest } = splitClauseMarker(text)
    return new Paragraph({
      spacing: { after: 100 },
      children: marker
        ? [new TextRun({ text: `${marker} `, bold: true }), new TextRun(rest)]
        : [new TextRun(text)],
    })
  }

  const TABLE_WIDTH = 9000
  const POSITION_COL = 6000
  const RATE_COL = TABLE_WIDTH - POSITION_COL

  const headerCell = (
    text: string,
    alignment: (typeof AlignmentType)[keyof typeof AlignmentType],
    width: number,
  ) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: '1A1108' },
      children: [
        new Paragraph({
          alignment,
          children: [new TextRun({ text, bold: true, color: 'FFFFFF' })],
        }),
      ],
    })

  const rateRow = (text: string, rightAlign: boolean, width: number) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      children: [
        new Paragraph({
          alignment: rightAlign ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [new TextRun(text)],
        }),
      ],
    })

  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const logoHeight = 26
  const logo = new ImageRun({
    type: 'png',
    data: await logoBytes(),
    transformation: { width: Math.round(logoHeight * LOGO_ASPECT), height: logoHeight },
  })

  const doc = new Document({
    sections: [
      {
        children: [
          // Encabezado: el machote real no trae logo — es adición deliberada,
          // igual que la Propuesta (Hugo, 2026-10-21).
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
                    children: [new Paragraph({ children: [logo] })],
                  }),
                  new TableCell({
                    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({
                            text: 'HOSPITALITY STAFFING',
                            color: '8A7A6A',
                            bold: true,
                            size: 17,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { after: 160 }, children: [] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'SERVICE AGREEMENT', bold: true })],
          }),
          body(
            `This Service Agreement ("Agreement") is between ${provider}, a Georgia limited ` +
              `liability company, ${PROVIDER_ADDRESS} ("Service Provider"), and ${displayName}` +
              `${input.propertyAddress ? `, ${input.propertyAddress}` : ''} ("Company").`,
          ),
          ...CONTRACT_CLAUSES.flatMap((clause, index) => [
            new Paragraph({
              spacing: { before: 200, after: 80 },
              children: [
                new TextRun({ text: `${String(index + 1)}. ${clause.title}`, bold: true }),
              ],
            }),
            ...clause.paragraphs.map((para) => clauseParagraph(fill(para))),
          ]),
          // Notices y Signatures faltaban por completo (Hugo, 2026-10-21):
          // el correo del hotel y el de Oranje solo vivían aquí.
          new Paragraph({
            spacing: { before: 300, after: 100 },
            children: [new TextRun({ text: 'NOTICES', bold: true })],
          }),
          new Paragraph({
            spacing: { after: 20 },
            children: [new TextRun({ text: 'Service Provider:', bold: true })],
          }),
          body(`${provider},`),
          body(`${PROVIDER_ADDRESS}.`),
          body(`Email: ${input.serviceProviderEmail ?? '______________________________'}.`),
          new Paragraph({
            spacing: { before: 200, after: 20 },
            children: [new TextRun({ text: 'Company:', bold: true })],
          }),
          body(displayName),
          ...(input.propertyAddress ? [body(input.propertyAddress)] : []),
          body(`Email: ${input.companyEmail ?? '______________________________'}.`),
          new Paragraph({
            spacing: { before: 300, after: 100 },
            children: [new TextRun({ text: 'SIGNATURES', bold: true })],
          }),
          new Paragraph({
            spacing: { after: 20 },
            children: [new TextRun({ text: `${provider} (Service Provider)`, bold: true })],
          }),
          body('By: ______________________________  Date: ____________'),
          body('Name/Title: ______________________________'),
          new Paragraph({
            spacing: { before: 200, after: 20 },
            children: [new TextRun({ text: `${displayName} (Company)`, bold: true })],
          }),
          body('By: ______________________________  Date: ____________'),
          body('Name/Title: ______________________________'),
          new Paragraph({
            spacing: { before: 400 },
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'Exhibit "A" - Rates', bold: true })],
          }),
          body(exhibitHeader(provider)),
          new Table({
            width: { size: TABLE_WIDTH, type: WidthType.DXA },
            columnWidths: [POSITION_COL, RATE_COL],
            rows: [
              new TableRow({
                children: [
                  headerCell('Position', AlignmentType.LEFT, POSITION_COL),
                  headerCell('Regular Hourly Bill Rate', AlignmentType.RIGHT, RATE_COL),
                ],
              }),
              ...input.rates.map(
                (rate) =>
                  new TableRow({
                    children: [
                      rateRow(rate.positionName, false, POSITION_COL),
                      rateRow(formatMoney(rate.billRate), true, RATE_COL),
                    ],
                  }),
              ),
            ],
          }),
          body(OVERTIME_NOTE),
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
