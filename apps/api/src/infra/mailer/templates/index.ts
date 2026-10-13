import { ILLUSTRATION_ACCESS, ILLUSTRATION_WELCOME } from './assets.js'
import { renderHtml, renderText, type LayoutParts } from './layout.js'

/**
 * Las plantillas viven en el repo y no en el editor de un proveedor (decisión
 * de Hugo, 2026-09-25): el texto humano queda versionado en Git y el español
 * y el inglés se escriben juntos, como en el front con Lingui.
 *
 * Aquí NO se usa Lingui: el catálogo `.po` es del front, que es quien lo
 * compila. Duplicarlo en el API obligaría a mantener dos catálogos, así que
 * cada plantilla lleva sus dos idiomas al lado y se leen de un vistazo.
 */
export type Locale = 'es' | 'en'

/** Lo que cada plantilla necesita para armarse. */
export interface TemplateData {
  'account-invitation': { name: string; link: string }
  'password-reset': { name: string; link: string }
  /** Las de gerencia nombran el puesto: es lo que las distingue. */
  'management-invitation': { name: string; link: string; roleName: string }
  'management-password-reset': { name: string; link: string; roleName: string }
  /**
   * Estado de las horas de una semana cerrada, para el Supervisor y el Manager
   * de Área de un hotel. Sale siempre el sábado, con o sin pendientes.
   * Los conteos son hojas de horas (un renglón por colaborador y requisición).
   */
  'hours-week-status': {
    name: string
    hotelName: string
    /** Lunes y domingo de la semana cerrada, `AAAA-MM-DD`. */
    weekStart: string
    weekEnd: string
    approved: number
    pending: number
  }
  /**
   * Factura al hotel (BORRADOR: sin envío todavía; decisión pendiente de Hugo).
   * Los textos llegan ya formateados: la plantilla no decide fechas ni monedas.
   * El PDF se adjuntaría fuera de esta plantilla; hoy no hay generador.
   */
  'invoice-to-hotel': {
    name: string
    hotelName: string
    folio: string
    /** Periodo legible, p. ej. «28 sep – 4 oct 2026». */
    periodLabel: string
    /** Total con moneda, ya formateado, p. ej. «$1,400.00». */
    totalLabel: string
  }
}

/**
 * Los ocho roles de gerencia (Roles del Sistema · uno por departamento, más
 * los dos del hotel). Reciben su propio correo: nombra el puesto y habla de
 * lo que ese puesto decide, no de «entrar a la app».
 *
 * El Administrador NO está aquí a propósito: el vault lo pone entre los
 * transversales, no en la línea de mando de ningún departamento.
 */
const MANAGEMENT_ROLES = new Set([
  'ROL-R-03', // Manager de Reclutamiento
  'ROL-H-03', // Manager General
  'ROL-H-02', // Manager de Área
  'ROL-V-02', // Business Developer Coordinator
  'ROL-I-02', // Coordinador de Inspección
  'ROL-Q-02', // Manager de QA
  'ROL-CS-02', // Customer Service Manager
  'ROL-CO-02', // Manager de Contabilidad
])

export const isManagementRole = (roleCode: string): boolean => MANAGEMENT_ROLES.has(roleCode)

export type TemplateName = keyof TemplateData

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

interface Template<K extends TemplateName> {
  /**
   * Qué correo de Firebase lo sustituye cuando el SMTP propio falla. `null`
   * significa que no hay respaldo posible — Firebase solo sabe mandar los
   * suyos —, y entonces el envío se registra como fallido para reintentarlo.
   */
  firebaseFallback: 'PASSWORD_RESET' | null
  build: (locale: Locale, data: TemplateData[K]) => { subject: string } & LayoutParts
}

/** El pie es el mismo en todos: por qué te llegó y qué hacer si no era para ti. */
const FOOTNOTE: Record<Locale, string> = {
  es: 'Recibes este correo porque alguien de Oranje creó o actualizó tu acceso. Si no lo esperabas, ignóralo y avísale a tu contacto en Oranje.',
  en: 'You are receiving this email because someone at Oranje created or updated your access. If you were not expecting it, ignore it and let your Oranje contact know.',
}

/** Saludo con nombre, o sin él cuando no lo tenemos: nunca «Hola ,». */
const greeting = (locale: Locale, name: string): string => {
  const clean = name.trim()

  if (locale === 'en') return clean ? `Hi ${clean},` : 'Hi,'

  return clean ? `Hola ${clean}:` : 'Hola:'
}

const accountInvitation: Template<'account-invitation'> = {
  firebaseFallback: 'PASSWORD_RESET',
  build: (locale, data) =>
    locale === 'en'
      ? {
          illustrationCid: ILLUSTRATION_WELCOME.cid,
          subject: 'Welcome to Oranje — set your password',
          heading: 'Welcome to Oranje',
          preheader: 'Your account is ready. Set your password to sign in.',
          paragraphs: [
            greeting(locale, data.name),
            'Your Oranje team set up an account for you. One step left: create your password and you are in.',
            'For your security, the link works once and expires in a few hours. If it expires, request a new one from the sign-in screen — no need to ask anyone.',
          ],
          action: { label: 'Create my password', url: data.link },
          footnote: FOOTNOTE.en,
        }
      : {
          illustrationCid: ILLUSTRATION_WELCOME.cid,
          subject: 'Te damos la bienvenida a Oranje',
          heading: 'Te damos la bienvenida a Oranje',
          preheader: 'Tu cuenta está lista. Crea tu contraseña para entrar.',
          paragraphs: [
            greeting(locale, data.name),
            'Tu equipo de Oranje ya te dio de alta. Falta un solo paso: crea tu contraseña y listo, adentro.',
            'Por tu seguridad, el enlace sirve una sola vez y caduca en unas horas. Si se te vence, pide uno nuevo desde la pantalla de inicio de sesión — sin trámites.',
          ],
          action: { label: 'Crear mi contraseña', url: data.link },
          footnote: FOOTNOTE.es,
        },
}

const passwordReset: Template<'password-reset'> = {
  firebaseFallback: 'PASSWORD_RESET',
  build: (locale, data) =>
    locale === 'en'
      ? {
          illustrationCid: ILLUSTRATION_ACCESS.cid,
          subject: 'Reset your Oranje password',
          heading: 'Let’s reset your password',
          preheader: 'Set a new password with this one-time link.',
          paragraphs: [
            greeting(locale, data.name),
            'We received a request to reset the password for your Oranje account. Use the button below to choose a new one.',
            'Didn’t request this? You can safely ignore this email — your current password keeps working and nothing changes.',
          ],
          action: { label: 'Choose a new password', url: data.link },
          footnote: FOOTNOTE.en,
        }
      : {
          illustrationCid: ILLUSTRATION_ACCESS.cid,
          subject: 'Restablece tu contraseña de Oranje',
          heading: 'Vamos a restablecer tu contraseña',
          preheader: 'Un enlace de un solo uso para poner una nueva.',
          paragraphs: [
            greeting(locale, data.name),
            'Recibimos una solicitud para restablecer la contraseña de tu cuenta de Oranje. Con el botón de abajo eliges una nueva.',
            '¿No fuiste tú? Ignora este correo con confianza: tu contraseña actual sigue funcionando y nada cambia.',
          ],
          action: { label: 'Elegir contraseña nueva', url: data.link },
          footnote: FOOTNOTE.es,
        },
}

const managementInvitation: Template<'management-invitation'> = {
  firebaseFallback: 'PASSWORD_RESET',
  build: (locale, data) =>
    locale === 'en'
      ? {
          illustrationCid: ILLUSTRATION_WELCOME.cid,
          subject: `Your ${data.roleName} access at Oranje`,
          heading: `Welcome, ${data.name.trim().split(/\s+/)[0] ?? ''}`,
          preheader: `Your ${data.roleName} account is ready.`,
          paragraphs: [
            greeting(locale, data.name),
            `Your Oranje account has been created as ${data.roleName}. From it you follow your department's work and sign off on what needs your decision.`,
            'Set your password with the button below. The link works once and expires in a few hours; if it does, ask for a new one from the sign-in screen.',
            'Reply to this email if anything looks off — someone at Oranje reads it.',
          ],
          action: { label: 'Set my password', url: data.link },
          footnote: FOOTNOTE.en,
        }
      : {
          illustrationCid: ILLUSTRATION_WELCOME.cid,
          subject: `Tu acceso de ${data.roleName} en Oranje`,
          heading: `Bienvenido, ${data.name.trim().split(/\s+/)[0] ?? ''}`,
          preheader: `Tu cuenta de ${data.roleName} ya está lista.`,
          paragraphs: [
            greeting(locale, data.name),
            `Tu cuenta de Oranje se creó como ${data.roleName}. Desde ahí sigues el trabajo de tu departamento y firmas lo que pasa por ti.`,
            'Crea tu contraseña con el botón de abajo. El enlace sirve una sola vez y caduca en unas horas; si se vence, pide uno nuevo desde la pantalla de inicio de sesión.',
            'Si algo no cuadra, responde a este correo: lo lee alguien de Oranje.',
          ],
          action: { label: 'Crear mi contraseña', url: data.link },
          footnote: FOOTNOTE.es,
        },
}

const managementPasswordReset: Template<'management-password-reset'> = {
  firebaseFallback: 'PASSWORD_RESET',
  build: (locale, data) =>
    locale === 'en'
      ? {
          illustrationCid: ILLUSTRATION_ACCESS.cid,
          subject: 'Reset your Oranje password',
          heading: 'Let’s get you back in',
          preheader: 'A one-time link to set a new password.',
          paragraphs: [
            greeting(locale, data.name),
            `We received a request to reset the password of your ${data.roleName} account.`,
            'Didn’t request this? Ignore this email — your current password keeps working. If it happens again without you asking, reply to this email.',
          ],
          action: { label: 'Choose a new password', url: data.link },
          footnote: FOOTNOTE.en,
        }
      : {
          illustrationCid: ILLUSTRATION_ACCESS.cid,
          subject: 'Restablece tu contraseña de Oranje',
          heading: 'Vamos a devolverte el acceso',
          preheader: 'Un enlace de un solo uso para poner una nueva.',
          paragraphs: [
            greeting(locale, data.name),
            `Recibimos una solicitud para restablecer la contraseña de tu cuenta de ${data.roleName}.`,
            '¿No fuiste tú? Ignora este correo: tu contraseña actual sigue funcionando. Si vuelve a pasar sin que lo pidas, responde a este correo.',
          ],
          action: { label: 'Elegir contraseña nueva', url: data.link },
          footnote: FOOTNOTE.es,
        },
}

/** «6 – 12 oct 2026», en el idioma de la persona, sin cambiar de zona: son fechas, no instantes. */
const rangeLabel = (locale: Locale, weekStart: string, weekEnd: string): string => {
  const format = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const at = (day: string): string => format.format(new Date(`${day}T00:00:00Z`))

  return `${at(weekStart)} – ${at(weekEnd)}`
}

const hoursWeekStatus: Template<'hours-week-status'> = {
  firebaseFallback: null,
  build: (locale, data) => {
    const range = rangeLabel(locale, data.weekStart, data.weekEnd)
    const { approved, pending } = data

    if (locale === 'en') {
      const summary =
        approved + pending === 0
          ? 'No timesheets were recorded for this week.'
          : pending === 0
            ? `All ${approved} timesheet${approved === 1 ? '' : 's'} for this week ${approved === 1 ? 'is' : 'are'} approved.`
            : `${approved} approved and ${pending} still waiting for approval. Hours that are not approved in time are not part of this week’s payment.`

      return {
        subject: `Hours for ${range} at ${data.hotelName}`,
        heading: `Hours for ${range}`,
        preheader:
          pending === 0
            ? 'Every timesheet for the week is approved.'
            : `${pending} timesheet${pending === 1 ? '' : 's'} still need approval.`,
        paragraphs: [greeting(locale, data.name), `${data.hotelName}: ${summary}`],
        footnote:
          'You are receiving this email because your Oranje account is responsible for hours at this hotel. It goes out every Saturday, even when nothing is pending.',
      }
    }

    const summary =
      approved + pending === 0
        ? 'No se registró ninguna hoja de horas en esta semana.'
        : pending === 0
          ? `Las ${approved} ${approved === 1 ? 'hoja de horas de esta semana ya está aprobada' : 'hojas de horas de esta semana ya están aprobadas'}.`
          : `${approved} ${approved === 1 ? 'aprobada' : 'aprobadas'} y ${pending} sin aprobar. Lo que no se apruebe a tiempo no entra al pago de esta semana.`

    return {
      subject: `Horas de ${range} en ${data.hotelName}`,
      heading: `Horas de ${range}`,
      preheader:
        pending === 0
          ? 'Todas las hojas de horas de la semana están aprobadas.'
          : `Quedan ${pending} ${pending === 1 ? 'hoja de horas' : 'hojas de horas'} por aprobar.`,
      paragraphs: [greeting(locale, data.name), `${data.hotelName}: ${summary}`],
      footnote:
        'Recibes este correo porque tu cuenta de Oranje responde por las horas de este hotel. Sale cada sábado, aunque no haya pendientes.',
    }
  },
}

/**
 * BORRADOR · no enviar sin aprobación de Hugo. Factura al hotel: el correo de
 * la factura emitida, con el PDF adjunto. Sin Firebase de respaldo: Firebase
 * solo manda sus propios correos, así que si el SMTP falla el envío queda
 * registrado para reintentarlo.
 */
const invoiceToHotel: Template<'invoice-to-hotel'> = {
  firebaseFallback: null,
  build: (locale, data) =>
    locale === 'en'
      ? {
          subject: `Oranje invoice ${data.folio}`,
          heading: `Your invoice ${data.folio}`,
          preheader: `Invoice ${data.folio} for ${data.periodLabel} is attached as a PDF.`,
          paragraphs: [
            greeting(locale, data.name),
            `Attached is invoice ${data.folio} for ${data.hotelName}, covering ${data.periodLabel}, for a total of ${data.totalLabel}.`,
            'The PDF shows the detail by collaborator and position, with the hours and the bill rate applied.',
            'Questions about the invoice? Reply to this email and your Oranje contact will answer.',
          ],
          footnote:
            'You are receiving this email because Oranje bills your hotel. If you are not the right person for your hotel’s invoices, reply and let us know.',
        }
      : {
          subject: `Factura ${data.folio} de Oranje`,
          heading: `Tu factura ${data.folio}`,
          preheader: `La factura ${data.folio} de ${data.periodLabel} va adjunta en PDF.`,
          paragraphs: [
            greeting(locale, data.name),
            `Adjuntamos la factura ${data.folio} de ${data.hotelName}, del periodo ${data.periodLabel}, por un total de ${data.totalLabel}.`,
            'El PDF trae el detalle por colaborador y puesto, con las horas y la tarifa aplicada.',
            '¿Tienes dudas sobre la factura? Responde a este correo y tu contacto en Oranje te contesta.',
          ],
          footnote:
            'Recibes este correo porque Oranje factura los servicios de tu hotel. Si no eres la persona indicada para las facturas de tu hotel, responde y avísanos.',
        },
}

const TEMPLATES = {
  'account-invitation': accountInvitation,
  'password-reset': passwordReset,
  'management-invitation': managementInvitation,
  'management-password-reset': managementPasswordReset,
  'invoice-to-hotel': invoiceToHotel,
  'hours-week-status': hoursWeekStatus,
} satisfies { [K in TemplateName]: Template<K> }

export const firebaseFallbackOf = (template: TemplateName): 'PASSWORD_RESET' | null =>
  TEMPLATES[template].firebaseFallback

export function renderTemplate<K extends TemplateName>(
  template: K,
  locale: Locale,
  data: TemplateData[K],
): RenderedEmail {
  /* El mapa de arriba ya garantiza, con `satisfies`, que cada plantilla recibe
     SUS datos; lo que TypeScript no sabe hacer es estrechar esa unión cuando
     la clave es genérica, así que el cast va aquí y en ningún otro lado. */
  const build = TEMPLATES[template].build as (
    locale: Locale,
    data: TemplateData[K],
  ) => { subject: string } & LayoutParts

  const { subject, ...parts } = build(locale, data)

  return { subject, html: renderHtml(parts), text: renderText(parts) }
}
