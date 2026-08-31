import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { HotelContact } from '../types/prospect.types'

import { SectionCard } from '@/shared/components/SectionCard'

/** El contacto principal se destaca en `--o-50`: es a quien hay que llamar primero. */
export function HotelContactList({
  contacts,
  onEdit,
}: {
  contacts: HotelContact[]
  onEdit: () => void
}): ReactNode {
  return (
    <SectionCard
      title="Contactos del hotel"
      action={
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-o-700 hover:bg-o-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
        >
          Editar
        </button>
      }
    >
      {contacts.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">
          Todavía no hay contactos. Usa «Editar» para agregar el primero.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className={cn(
                'rounded-md p-4',
                contact.isPrimary ? 'bg-o-50' : 'bg-surface-2 border border-line',
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{contact.name}</p>
                {contact.isPrimary && (
                  <span className="shrink-0 text-xs font-semibold text-ink-2">Principal</span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink-3">{contact.role}</p>
              <a
                href={`tel:${contact.phone.replace(/\s/g, '')}`}
                className="mt-1 block text-sm text-ink-2 hover:text-o-700"
              >
                {contact.phone}
              </a>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
