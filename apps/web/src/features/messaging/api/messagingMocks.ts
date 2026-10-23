import type { MessagingOverview } from './messagingApi'
import type { MessagingContact, MessagingContacts } from './messagingApi'
import type { MessagingContactInput, MessagingTags } from './messagingApi'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/** Lo que hoy tiene la plataforma real: la campaña de prueba de la oficina. */
const overview: MessagingOverview = {
  configured: true,
  contacts: 4,
  templates: 4,
  campaigns: 1,
  recentCampaigns: [
    {
      id: 'cmp-prueba-oficina',
      name: 'Prueba oficina',
      templateName: 'hello_world',
      status: 'COMPLETED',
      sentCount: 3,
      totalRecipients: 3,
      createdAt: '2026-09-11T15:29:00.000Z',
    },
  ],
}

const OFICINA = { id: 'tag-oficina', name: 'Oficina', color: '#3B82F6' }
const PRUEBAS = { id: 'tag-pruebas', name: 'Pruebas', color: '#F97316' }

/** Los cuatro contactos del Panel: tres reciben y uno se dio de baja. */
const contacts: MessagingContact[] = [
  {
    id: 'ct-ana',
    firstName: 'Ana',
    lastName: 'Ruiz',
    phone: '5215512345678',
    email: 'ana@oranjepeople.com',
    optedOut: false,
    tags: [OFICINA],
  },
  {
    id: 'ct-luis',
    firstName: 'Luis',
    lastName: 'Pérez',
    phone: '5215587654321',
    email: null,
    optedOut: false,
    tags: [OFICINA, PRUEBAS],
  },
  {
    id: 'ct-marta',
    firstName: 'Marta',
    lastName: null,
    phone: '14045550123',
    email: 'marta@example.com',
    optedOut: false,
    tags: [],
  },
  {
    id: 'ct-jorge',
    firstName: 'Jorge',
    lastName: 'Díaz',
    phone: '5215511122233',
    email: null,
    optedOut: true,
    tags: [PRUEBAS],
  },
]

const CONTACTS_PER_PAGE = 20

/** Busca como la plataforma: nombre, apellido, teléfono o email. */
function mockContacts(search: URLSearchParams): MessagingContacts {
  const page = Math.max(1, Number(search.get('page') ?? '1'))
  const term = (search.get('search') ?? '').trim().toLowerCase()
  const matches = contacts.filter((contact) =>
    [contact.firstName, contact.lastName, contact.phone, contact.email].some(
      (value) => value !== null && value.toLowerCase().includes(term),
    ),
  )
  const start = (page - 1) * CONTACTS_PER_PAGE

  return {
    configured: true,
    contacts: matches.slice(start, start + CONTACTS_PER_PAGE),
    pagination: {
      page,
      limit: CONTACTS_PER_PAGE,
      total: matches.length,
      totalPages: Math.ceil(matches.length / CONTACTS_PER_PAGE),
    },
  }
}

const TAGS = [OFICINA, PRUEBAS]

/* Las que pone «Sincronizar colaboradores»: con ellas se eligen los
   destinatarios de una campaña. */
TAGS.push(
  { id: 'tag-oranje', name: 'Oranje', color: '#F51149' },
  { id: 'tag-hotel-riu', name: 'Hotel: Riu Cancún', color: '#F51149' },
  { id: 'tag-hotel-hyatt', name: 'Hotel: Hyatt Ziva', color: '#F51149' },
  { id: 'tag-estado-disponible', name: 'Estado: Disponible', color: '#F51149' },
  { id: 'tag-estado-asignado', name: 'Estado: Asignado', color: '#F51149' },
)

function mockTags(): MessagingTags {
  return {
    configured: true,
    tags: TAGS.map((tag) => ({
      ...tag,
      contactCount: contacts.filter((contact) => contact.tags.some(({ id }) => id === tag.id))
        .length,
    })),
  }
}

/** Como la plataforma: E.164 sin `+`; 10 dígitos de MX o US llevan su lada. */
function mockPhone(raw: string, countryCode: string | undefined): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) throw new Error(`Teléfono inválido: "${raw}"`)
  if (digits.length === 10 && countryCode === 'MX') return `52${digits}`
  if (digits.length === 10) return `1${digits}`
  return digits
}

function findContact(id: string | undefined): MessagingContact {
  const contact = contacts.find((candidate) => candidate.id === id)
  if (!contact) throw new Error('Contacto no encontrado')
  return contact
}

/**
 * RTK Query congela lo que recibe, y la lista devuelve estos mismos objetos:
 * se cambia una copia y se pone en su lugar, nunca el original.
 */
function replaceContact(
  id: string | undefined,
  change: (copy: MessagingContact) => void,
): MessagingContact {
  const original = findContact(id)
  const copy = structuredClone(original)
  change(copy)
  contacts[contacts.indexOf(original)] = copy
  return copy
}

function applyInput(contact: MessagingContact, input: MessagingContactInput): void {
  if (input.firstName !== undefined) contact.firstName = input.firstName
  if (input.lastName !== undefined) contact.lastName = input.lastName
  if (input.email !== undefined) contact.email = input.email
  if (input.phone !== undefined) {
    const phone = mockPhone(input.phone, input.countryCode)
    if (contacts.some((other) => other.phone === phone && other.id !== contact.id)) {
      throw new Error('Ya existe un contacto con ese teléfono')
    }
    contact.phone = phone
  }
  if (input.tagIds !== undefined) {
    contact.tags = TAGS.filter((tag) => input.tagIds?.includes(tag.id))
  }
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/messaging/tags',
    resolve: (): ApiEnvelope<MessagingTags> => ({ data: mockTags() }),
  },
  {
    method: 'POST',
    path: '/messaging/contacts',
    resolve: ({ body }): ApiEnvelope<MessagingContact> => {
      const contact: MessagingContact = {
        id: `ct-${String(Date.now())}`,
        firstName: '',
        lastName: null,
        phone: '',
        email: null,
        optedOut: false,
        tags: [],
      }
      applyInput(contact, body as MessagingContactInput)
      contacts.unshift(contact)
      return { data: contact }
    },
  },
  {
    method: 'PATCH',
    path: '/messaging/contacts/:id',
    resolve: ({ params, body }): ApiEnvelope<MessagingContact> => ({
      data: replaceContact(params.id, (copy) => {
        applyInput(copy, body as MessagingContactInput)
      }),
    }),
  },
  {
    method: 'POST',
    path: '/messaging/contacts/:id/opt-out',
    resolve: ({ params }): ApiEnvelope<MessagingContact> => ({
      data: replaceContact(params.id, (copy) => {
        copy.optedOut = true
      }),
    }),
  },
  {
    method: 'DELETE',
    path: '/messaging/contacts/:id',
    resolve: ({ params }): null => {
      contacts.splice(contacts.indexOf(findContact(params.id)), 1)
      return null
    },
  },
  {
    method: 'GET',
    path: '/messaging/overview',
    resolve: (): ApiEnvelope<MessagingOverview> => ({ data: overview }),
  },
  {
    method: 'GET',
    path: '/messaging/contacts',
    resolve: ({ search }): ApiEnvelope<MessagingContacts> => ({ data: mockContacts(search) }),
  },
]

export function registerMessagingMocks(): void {
  registerMockRoutes(routes)
}
