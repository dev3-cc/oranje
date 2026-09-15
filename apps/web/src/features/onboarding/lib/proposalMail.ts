import type { ProposalVersionSummary } from '../types/proposal.types'

/**
 * El correo de la propuesta se manda desde el cliente de la persona, no desde
 * el servidor: el hotel recibe un correo de su Business Developer con nombre y
 * firma, y no un remitente automático que además caería en spam sin SPF ni
 * DKIM configurados.
 *
 * Lo que hacemos aquí es dejarle el correo escrito. El PDF lo adjunta quien
 * envía, desde la misma pantalla donde acaba de guardarlo: un `mailto` no
 * puede llevar adjuntos — es una limitación del esquema, no del código.
 */
export function buildProposalMailto({
  to,
  hotelName,
  version,
  senderName,
}: {
  to: string | null
  hotelName: string
  version: ProposalVersionSummary
  senderName: string
}): string {
  const subject = `Propuesta de servicios Oranje para ${hotelName}`
  const rateLines =
    version.rates.length > 0
      ? version.rates
          .map(
            (rate) =>
              `- ${rate.positionName}: $${rate.payRate.toFixed(2)} por hora al colaborador, $${rate.billRate.toFixed(2)} facturado.`,
          )
          .join('\n')
      : '- Las tarifas van en el documento adjunto.'

  const body = [
    'Hola:',
    '',
    `Te comparto la propuesta de servicios de Oranje para ${hotelName}.`,
    '',
    version.servicesNote ? `Qué cubrimos: ${version.servicesNote}` : '',
    '',
    'Tarifas por puesto (por hora trabajada):',
    rateLines,
    '',
    'Adjunto el documento con el detalle y el anexo de condiciones.',
    '',
    'Quedo al pendiente de tus comentarios.',
    senderName,
  ]
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n')

  const params = new URLSearchParams({ subject, body })

  /* URLSearchParams codifica el espacio como "+", que varios clientes muestran
     literal en el asunto: hay que devolverlo a %20. */
  return `mailto:${to ?? ''}?${params.toString().replace(/\+/g, '%20')}`
}
