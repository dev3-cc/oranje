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

const TEMPLATES = {
  'account-invitation': accountInvitation,
  'password-reset': passwordReset,
  'management-invitation': managementInvitation,
  'management-password-reset': managementPasswordReset,
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
