import { formatMoney } from './formatters'

import logoOrange from '@/assets/logo/Logo_ORANJE_Orange.png'

/** 4626×429 px real del archivo: todo lo que lo dibuja parte de esta razón. */
const LOGO_ASPECT = 4626 / 429

/**
 * El logo vive como archivo aparte (no inline): `jsPDF.addImage` y el
 * `ImageRun` de `docx` piden los bytes, no la URL de Vite. Una sola descarga
 * por sesión de pestaña — ni el PDF ni el Word se arman más de una vez
 * seguida como para que importe cachearla más que eso.
 */
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
 * El contenido fijo del machote real que trajo Hugo
 * (`ORANJE_PEOPLE_Staffing_Proposal_Template.docx`, 2026-10-17): transcrito
 * tal cual, en inglés, porque es el documento que recibe el hotel — los
 * rótulos de la app alrededor siguen en español (mismo criterio que
 * `ContractDocument`).
 *
 * Es un documento DISTINTO al Service Agreement de `ContractDocument`: esta
 * es la propuesta comercial que ve el hotel ANTES de firmar nada, y por eso
 * el cuadro de tarifas aquí muestra solo el bill rate — el pay rate es el
 * margen interno de Oranje y no se le enseña al cliente.
 */

/**
 * Las dos cartas de apertura y el recuadro de objetivo (p. 1 del machote):
 * el BD las comparó contra el MASTER y faltaba media carta — la primera
 * transcripción las había resumido (Hugo, 2026-10-19).
 */
export const INTRO_PARAGRAPH_1 =
  'Thank you for the opportunity to present ORANJE PEOPLE as a staffing partner for your ' +
  'operation. We are structured to work as an extension of your leadership team — not simply ' +
  'as a source of temporary labor. Our recruiting, training, deployment, time-tracking, ' +
  'quality-assurance, and performance-management processes are designed to provide dependable ' +
  'coverage while supporting your service standards and day-to-day operational goals.'

export const INTRO_PARAGRAPH_2 =
  'Whether you need recurring staffing, support for call-outs, additional coverage during ' +
  'high-demand periods, or a larger workforce for seasonal and event-driven needs, our model ' +
  'is designed to scale with your operation while maintaining accountability, visibility, and ' +
  'consistent service.'

export const OBJECTIVE_NOTE =
  'Our objective: give your leadership team a responsive, accountable staffing partner that can ' +
  'scale with occupancy, events, call-outs, and seasonal demand without sacrificing service standards.'

export const WHAT_YOU_CAN_EXPECT: string[] = [
  'Dedicated recruitment support for hospitality positions',
  '24-hour staffing response for urgent and planned coverage needs',
  'Same-day on-call deployment when qualified personnel are available',
  'General, compliance, and procedure-based training',
  'Digital time and attendance tracking for assigned staff',
  'Quality inspections, coaching, performance development, and replacement support',
]

export const PROCESS_STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Recruitment & Readiness',
    body: 'Our recruiting team maintains an active hospitality candidate pipeline so coverage needs can be addressed quickly. Candidates are matched to the position and operational expectations before deployment.',
  },
  {
    title: 'Onboarding & Training',
    body: 'Team members receive general orientation plus role and procedure guidance before assignment. Compliance expectations and property-specific instructions can be incorporated into onboarding.',
  },
  {
    title: 'Deployment, Scheduling & Time Tracking',
    body: 'ORANJE PEOPLE coordinates assignments around the client’s requested schedules, occupancy or workload levels, events, and operational needs. Our workforce system tracks scheduled shifts, clock-in/clock-out activity, attendance, and hours worked so coverage gaps and time issues can be identified quickly.',
  },
  {
    title: 'Quality Inspections',
    body: 'Quality is verified through scheduled and spot inspections. Findings are documented against operating expectations so strengths, recurring issues, and opportunities for improvement can be addressed with clear feedback.',
  },
  {
    title: 'Coaching & Performance Management',
    body: 'We combine inspection results, attendance, productivity, and client feedback to coach and retrain team members. Our goal is to help each employee become more reliable, capable, and aligned with the standards of the client operation. When performance does not improve or staffing needs change, ORANJE PEOPLE can coordinate a qualified replacement.',
  },
  {
    title: 'Account Support & Coverage',
    body: 'Your management team has a direct service contact for staffing requests, schedule changes, escalations, and performance concerns. When additional or replacement coverage is needed, our recruiting and on-call teams work to respond quickly and keep the operation supported.',
  },
]

export const CORE_POSITIONS =
  'Housekeeping / Room Attendants • Housemen • Laundry • Lobby / Public Areas • ' +
  'Housekeeping Supervisors • Maintenance • Banquet Service & Setup • Dishwashing • ' +
  'Prep Cook / Cook • Chef • Hotel Management • Warehouse • Retail'

/** El recuadro naranja que cierra "A More Accountable Staffing Model" (p. 2),
    faltante por completo en la primera transcripción. */
export const WORKFORCE_SYSTEM_TITLE = 'ORANJE PEOPLE WORKFORCE PERFORMANCE SYSTEM'
export const WORKFORCE_SYSTEM_FLOW =
  'TRACK TIME → INSPECT QUALITY → COACH & DEVELOP → ADJUST COVERAGE'
export const WORKFORCE_SYSTEM_BODY =
  'This system creates a continuous performance loop: we verify time and attendance, inspect ' +
  'the quality of work, coach and retrain employees toward stronger performance, and, when the ' +
  'current assignment is no longer the right fit or operational needs change, deploy a new team ' +
  'member to maintain coverage and service standards.'

export const COMMERCIAL_TERMS: string[] = [
  'Payment terms: Net 30 from invoice date unless otherwise agreed in writing.',
  'Credit terms: Subject to credit approval, anticipated staffing volume, and the parties’ executed staffing/service agreement.',
  'Overtime: When applicable, overtime is billed at 1.5x the regular hourly bill rate.',
  'Scheduling & workforce management: Staffing is based on requested schedules, operational demand, and personnel availability. ORANJE PEOPLE tracks assigned time and attendance through its workforce management process, and same-day requests are prioritized through the on-call process.',
  'Proposal and agreement: This proposal summarizes the commercial offer. Ongoing services remain subject to the parties’ executed staffing/service agreement and any written amendments.',
]

/** Entre el cuadro de tarifas y "Partnership & Acceptance" en el machote (p. 4). */
export const PRICING_NOTE =
  'Pricing note: Rates are customized for each client and location. Final bill rates will be confirmed in writing before staffing begins. Additional positions can be quoted upon request.'

export const PARTNERSHIP_INTRO =
  'We appreciate the opportunity to support your operation. Our goal is to provide a staffing ' +
  'partnership that is responsive, measurable, and easy for your leadership team to manage — ' +
  'with clear visibility into attendance, work quality, employee development, and coverage.'

export const NEXT_STEPS: string[] = [
  'Confirm the positions and anticipated staffing volume.',
  'Confirm acceptance of proposed bill rates.',
  'Identify property-specific training, brand standards, access, and scheduling requirements.',
  'Execute the applicable staffing/service agreement.',
  'Set the launch date and initial deployment schedule.',
]

/** Encabezado del bloque de firmas (p. 4), faltante por completo. */
export const CLIENT_ACCEPTANCE_INTRO =
  'By signing below, the Client acknowledges acceptance of the scope and proposed rates stated ' +
  'in this proposal, subject to the parties’ executed staffing/service agreement.'

export const TAGLINE = 'Reliable staffing. Fast response. Consistent hotel standards.'
export const FOOTER_SLOGAN = 'PEOPLE. PROCEDURES. STRATEGIES. SOLUTIONS.'

/** Un renglón del cuadro: solo el bill rate llega al hotel. */
export interface ProposalDocumentRate {
  key: string
  positionName: string
  billRate: number
}

export interface ProposalDocumentInput {
  hotelName: string
  rates: ProposalDocumentRate[]
  senderName: string
  /** Campos del machote aprobado (Hugo, 2026-10-19): todos opcionales porque
      un borrador recién abierto puede no traerlos todavía. */
  /** [PROPERTY NAME] del documento; cae en `hotelName` si no hay override. */
  propertyName: string | null
  /** "Prepared [DATE]"; cae en `preparedDateUs()` (hoy) si no hay override. */
  preparedDate: string | null
  brandManagementCompany: string | null
  cityState: string | null
  /** A quién va dirigida la carta ("Dear [CONTACT NAME],"). */
  contactName: string | null
  senderPhone: string | null
  senderEmail: string | null
}

/** "10/19/2026" — mismo formato que el machote ("Prepared [DATE]"). */
export function preparedDateUs(): string {
  return todayUs()
}

function todayUs(): string {
  const now = new Date()
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${String(now.getFullYear())}`
}

/** `hotel-mirador` desde «Hotel Mirador» — mismo criterio que la factura. */
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

/**
 * El mismo documento que la vista previa, en PDF — mismo patrón que
 * `invoiceDocument.ts`: dibujo manual con `jsPDF`, sin sumar `html2canvas`.
 * Devuelve el `jsPDF` ya armado: quien llama decide si lo descarga
 * (`.save()`) o lo adjunta al correo (`.output('arraybuffer')`).
 */
export async function buildProposalPdf(input: ProposalDocumentInput) {
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

  /**
   * La caja gris con borde naranja ("Our objective" / "Pricing note" / el
   * workforce system del machote). Cada segmento es su propio párrafo dentro
   * de la caja, con su propio peso/color/tamaño — así el workforce system
   * puede llevar título naranja + flujo en negritas + cuerpo normal, igual
   * que en Word y en la vista previa, en vez de un bloque plano.
   */
  function calloutBox(
    segments: Array<{
      text: string
      bold?: boolean
      color?: string
      size?: number
      spacingBefore?: number
    }>,
  ): void {
    const padX = 14
    const padY = 12
    const lineGap = 1.4
    const wrapped = segments.map((segment) => {
      const size = segment.size ?? 9.5
      const lines = doc.splitTextToSize(segment.text, contentWidth - padX * 2) as string[]
      return { ...segment, size, lines }
    })
    const contentHeight = wrapped.reduce(
      (sum, segment) =>
        sum + (segment.spacingBefore ?? 0) + segment.lines.length * segment.size * lineGap,
      0,
    )
    const boxHeight = contentHeight + padY * 2
    ensureRoom(0, boxHeight)
    y += 8
    doc.setFillColor('#F4F2EE')
    doc.rect(margin, y, contentWidth, boxHeight, 'F')
    doc.setFillColor('#F97316')
    doc.rect(margin, y, 3, boxHeight, 'F')
    let ty = y + padY
    for (const segment of wrapped) {
      ty += segment.spacingBefore ?? 0
      doc.setFont('helvetica', segment.bold ? 'bold' : 'normal')
      doc.setFontSize(segment.size)
      doc.setTextColor(segment.color ?? ink)
      doc.text(segment.lines, margin + padX, ty + segment.size * 0.8)
      ty += segment.lines.length * segment.size * lineGap
    }
    y += boxHeight + 14
  }

  /** `→` no existe en WinAnsi (la codificación de las fuentes base de
      jsPDF): sin esto sale un glifo roto. Solo aquí — Word y la vista
      previa sí tienen Unicode de verdad y usan la flecha real. */
  function pdfSafe(text: string): string {
    return text.replace(/→/g, '->')
  }

  function heading(text: string): void {
    ensureRoom(2, 20)
    y += 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(ink)
    doc.text(text, margin, y)
    y += 6
    doc.setDrawColor(ink3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 16
  }

  function bullet(text: string): void {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(ink2)
    const lines = doc.splitTextToSize(text, contentWidth - 14) as string[]
    ensureRoom(lines.length)
    doc.text('•', margin, y)
    doc.text(lines, margin + 14, y)
    y += lines.length * 13 + 2
  }

  // Encabezado: logo estático (sin animación, el naranja fijo del letterhead).
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
  doc.setFontSize(13)
  doc.setTextColor(ink)
  doc.text('STAFFING PARTNERSHIP PROPOSAL', margin, y)
  y += 30
  // [PROPERTY NAME]: el texto más grande de todo el machote, por mucho.
  doc.setFontSize(28)
  doc.text(input.propertyName || input.hotelName, margin, y)
  y += 26
  if (input.brandManagementCompany) {
    doc.setFontSize(16)
    doc.text(input.brandManagementCompany, margin, y)
    y += 20
  }
  if (input.cityState) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    doc.setTextColor(ink3)
    doc.text(input.cityState, margin, y)
    y += 16
  }
  y += 2
  doc.setFontSize(9.5)
  doc.setTextColor(ink3)
  doc.text(TAGLINE, margin, y)
  y += 14
  doc.text(`Prepared ${input.preparedDate || todayUs()}`, margin, y)
  y += 20

  if (input.contactName) {
    paragraph(`Dear ${input.contactName},`, { bold: true, color: ink })
  }

  paragraph(INTRO_PARAGRAPH_1)
  paragraph(INTRO_PARAGRAPH_2)
  calloutBox([{ text: OBJECTIVE_NOTE, bold: true }])

  heading('WHAT YOU CAN EXPECT')
  for (const line of WHAT_YOU_CAN_EXPECT) bullet(line)

  heading('A MORE ACCOUNTABLE STAFFING MODEL')
  for (const step of PROCESS_STEPS) {
    paragraph(step.title, { bold: true, size: 10, color: ink })
    paragraph(step.body)
  }

  heading('CORE POSITIONS WE CAN SUPPORT')
  paragraph(CORE_POSITIONS)

  y += 4
  calloutBox([
    { text: WORKFORCE_SYSTEM_TITLE, bold: true, color: '#C2410C' },
    { text: pdfSafe(WORKFORCE_SYSTEM_FLOW), bold: true, spacingBefore: 4 },
    { text: WORKFORCE_SYSTEM_BODY, spacingBefore: 6 },
  ])

  heading('PROPOSED RATE SCHEDULE')
  paragraph(
    'Client-specific bill rates are customized based on market, role, staffing volume, schedule, and scope of service.',
    {
      size: 8.5,
      color: ink3,
    },
  )
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(ink)
  ensureRoom(2)
  doc.text('POSITION', margin, y)
  doc.text('REGULAR HOURLY BILL RATE', pageWidth - margin, y, { align: 'right' })
  y += 6
  doc.setDrawColor(ink3)
  doc.line(margin, y, pageWidth - margin, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(ink2)
  for (const rate of input.rates) {
    ensureRoom(1)
    doc.text(rate.positionName, margin, y)
    doc.text(formatMoney(rate.billRate), pageWidth - margin, y, { align: 'right' })
    y += 15
  }
  y += 6

  heading('COMMERCIAL TERMS')
  for (const line of COMMERCIAL_TERMS) paragraph(line)

  y += 6
  calloutBox([{ text: PRICING_NOTE, bold: true }])

  heading('PARTNERSHIP & ACCEPTANCE')
  paragraph(PARTNERSHIP_INTRO)
  paragraph('NEXT STEPS', { bold: true, size: 10, color: ink })
  for (const line of NEXT_STEPS) bullet(line)

  paragraph('CLIENT ACCEPTANCE', { bold: true, size: 10, color: ink })
  paragraph(CLIENT_ACCEPTANCE_INTRO)

  ensureRoom(6, 20)
  y += 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(ink)
  doc.text('Client Authorized Representative', margin, y)
  doc.text('ORANJE PEOPLE', pageWidth / 2 + 10, y)
  y += 28
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(ink3)
  for (const label of ['Printed Name / Title', 'Signature', 'Date']) {
    doc.text(`${label}: ______________________________`, margin, y)
    doc.text(`${label}: ______________________________`, pageWidth / 2 + 10, y)
    y += 18
  }

  y += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(ink)
  doc.text(input.senderName, pageWidth - margin, y, { align: 'right' })
  y += 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(ink3)
  doc.text('ORANJE PEOPLE Business Development', pageWidth - margin, y, { align: 'right' })
  if (input.senderPhone) {
    y += 12
    doc.text(input.senderPhone, pageWidth - margin, y, { align: 'right' })
  }
  if (input.senderEmail) {
    y += 12
    doc.text(input.senderEmail, pageWidth - margin, y, { align: 'right' })
  }

  y += 16
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(ink3)
  doc.text(FOOTER_SLOGAN, margin, y)

  return { doc, filename: `propuesta-${slugify(input.hotelName)}.pdf` }
}

/** Descarga directa (el botón «Descargar PDF»): mismo patrón que `invoiceDocument.ts`. */
export async function downloadProposalPdf(input: ProposalDocumentInput): Promise<void> {
  const { doc, filename } = await buildProposalPdf(input)
  doc.save(filename)
}

/** Los bytes para adjuntar al correo, sin bajarlo también al disco. */
export async function proposalPdfBlob(input: ProposalDocumentInput): Promise<Blob> {
  const { doc } = await buildProposalPdf(input)
  return doc.output('blob')
}

/**
 * El mismo contenido en `.docx` (Hugo, 2026-10-17: "un botón para descargar
 * en Word y PDF") — alguien del hotel lo edita o lo pasa a su plantilla de
 * compras antes de firmar nada, y un PDF no se edita.
 */
export async function downloadProposalDocx(input: ProposalDocumentInput): Promise<void> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    ImageRun,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import('docx')

  const INK = '1A1108'
  const INK3 = '8A7A6A'

  const logoHeight = 26
  const logo = new ImageRun({
    type: 'png',
    data: await logoBytes(),
    transformation: { width: Math.round(logoHeight * LOGO_ASPECT), height: logoHeight },
  })

  const title = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 120 },
      children: [new TextRun({ text, bold: true, color: INK })],
    })

  const body = (text: string) =>
    new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text, color: INK })] })

  const bullet = (text: string) =>
    new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun(text)] })

  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }

  /** La caja gris con borde naranja ("Our objective" / "Pricing note" / el
      recuadro del workforce system del machote): una tabla de una celda, que
      es como `docx` logra el fondo + borde que un `Paragraph` suelto no da. */
  const calloutBox = (children: InstanceType<typeof Paragraph>[]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: 'F4F2EE' },
              borders: {
                top: noBorder,
                bottom: noBorder,
                right: noBorder,
                left: { style: BorderStyle.SINGLE, size: 24, color: 'F97316' },
              },
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
              children,
            }),
          ],
        }),
      ],
    })

  const cell = (text: string, align: 'left' | 'right' = 'left') =>
    new TableCell({
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
      children: [
        new Paragraph({
          alignment: align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [new TextRun(text)],
        }),
      ],
    })

  const doc = new Document({
    sections: [
      {
        children: [
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
                            color: INK3,
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
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'STAFFING PARTNERSHIP PROPOSAL', bold: true, size: 20 }),
            ],
          }),
          /* [PROPERTY NAME] es el texto más grande de todo el machote — por
             mucho más que el label de arriba o que marca/ciudad debajo. */
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: input.propertyName || input.hotelName, bold: true, size: 56 }),
            ],
          }),
          ...(input.brandManagementCompany
            ? [
                new Paragraph({
                  spacing: { after: 20 },
                  children: [
                    new TextRun({ text: input.brandManagementCompany, bold: true, size: 32 }),
                  ],
                }),
              ]
            : []),
          ...(input.cityState
            ? [
                new Paragraph({
                  children: [new TextRun({ text: input.cityState, color: INK3, size: 21 })],
                }),
              ]
            : []),
          new Paragraph({
            spacing: { before: 80 },
            children: [new TextRun({ text: TAGLINE, color: INK3, italics: true })],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: `Prepared ${input.preparedDate || todayUs()}`,
                color: INK3,
                italics: true,
              }),
            ],
          }),
          ...(input.contactName
            ? [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun({ text: `Dear ${input.contactName},`, bold: true })],
                }),
              ]
            : []),
          body(INTRO_PARAGRAPH_1),
          body(INTRO_PARAGRAPH_2),
          new Paragraph({ spacing: { after: 160 }, children: [] }),
          calloutBox([
            new Paragraph({ children: [new TextRun({ text: OBJECTIVE_NOTE, bold: true })] }),
          ]),
          new Paragraph({ spacing: { after: 160 }, children: [] }),

          title('What You Can Expect'),
          ...WHAT_YOU_CAN_EXPECT.map((line) => bullet(line)),

          title('A More Accountable Staffing Model'),
          ...PROCESS_STEPS.flatMap((step) => [
            new Paragraph({ children: [new TextRun({ text: step.title, bold: true })] }),
            body(step.body),
          ]),

          title('Core Positions We Can Support'),
          body(CORE_POSITIONS),
          new Paragraph({ spacing: { after: 160 }, children: [] }),
          calloutBox([
            new Paragraph({
              children: [
                new TextRun({ text: WORKFORCE_SYSTEM_TITLE, bold: true, color: 'C2410C' }),
              ],
            }),
            new Paragraph({
              spacing: { before: 60 },
              children: [new TextRun({ text: WORKFORCE_SYSTEM_FLOW, bold: true })],
            }),
            new Paragraph({
              spacing: { before: 60 },
              children: [new TextRun(WORKFORCE_SYSTEM_BODY)],
            }),
          ]),

          title('Proposed Rate Schedule'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [cell('Position'), cell('Regular Hourly Bill Rate', 'right')],
              }),
              ...input.rates.map(
                (rate) =>
                  new TableRow({
                    children: [cell(rate.positionName), cell(formatMoney(rate.billRate), 'right')],
                  }),
              ),
            ],
          }),

          title('Commercial Terms'),
          ...COMMERCIAL_TERMS.map((line) => body(line)),
          new Paragraph({ spacing: { before: 160, after: 160 }, children: [] }),
          calloutBox([
            new Paragraph({ children: [new TextRun({ text: PRICING_NOTE, bold: true })] }),
          ]),

          title('Partnership & Acceptance'),
          body(PARTNERSHIP_INTRO),
          new Paragraph({ children: [new TextRun({ text: 'Next Steps', bold: true })] }),
          ...NEXT_STEPS.map((line) => bullet(line)),

          new Paragraph({
            spacing: { before: 400 },
            children: [new TextRun({ text: 'Client Acceptance', bold: true })],
          }),
          body(CLIENT_ACCEPTANCE_INTRO),
          new Paragraph({
            spacing: { before: 200 },
            children: [new TextRun('Client Authorized Representative — ORANJE PEOPLE')],
          }),
          new Paragraph({
            spacing: { before: 200 },
            children: [new TextRun('Printed Name / Title: ______________________________')],
          }),
          new Paragraph({
            spacing: { before: 100 },
            children: [new TextRun('Signature: ______________________________')],
          }),
          new Paragraph({
            spacing: { before: 100 },
            children: [new TextRun('Date: ______________________________')],
          }),

          new Paragraph({
            spacing: { before: 400 },
            children: [new TextRun({ text: input.senderName, bold: true })],
          }),
          new Paragraph({
            children: [new TextRun({ text: 'ORANJE PEOPLE Business Development', color: INK3 })],
          }),
          ...(input.senderPhone
            ? [new Paragraph({ children: [new TextRun({ text: input.senderPhone, color: INK3 })] })]
            : []),
          ...(input.senderEmail
            ? [new Paragraph({ children: [new TextRun({ text: input.senderEmail, color: INK3 })] })]
            : []),

          new Paragraph({
            spacing: { before: 400 },
            children: [new TextRun({ text: FOOTER_SLOGAN, italics: true, color: INK3, size: 16 })],
          }),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `propuesta-${slugify(input.hotelName)}.docx`
  link.click()
  URL.revokeObjectURL(url)
}
