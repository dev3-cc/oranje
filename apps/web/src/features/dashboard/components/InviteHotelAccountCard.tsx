import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { HotelUserFormDialog } from '@/features/admin'
import { Button } from '@/shared/components/Button'
import { useCan } from '@/shared/hooks/useCan'
import type { SessionUser } from '@/shared/types/session.types'

/**
 * El hotel invita a su propia gente, sin llamar a Oranje.
 *
 * Nace de un problema medido (Hugo, 2026-09-30): los gerentes rotan, el nuevo
 * no hereda el correo del anterior y cada cambio caía en el Administrador. En
 * producción, 34 de 36 hoteles tienen un solo gerente y nadie más, así que
 * cuando ese se va no queda quien dé de alta al siguiente.
 *
 * Quién alcanza a qué rol lo decide el servidor, no esta tarjeta; aquí solo
 * se muestra a quien puede invitar.
 */
export function InviteHotelAccountCard({ session }: { session: SessionUser }): ReactNode {
  const { t } = useLingui()
  const can = useCan()
  const [isOpen, setIsOpen] = useState(false)

  if (!can('users:invite_hotel') || !session.hotel) return null

  const hotel = session.hotel

  return (
    <>
      <section className="flex flex-wrap items-center gap-4 rounded-[18px] border border-line bg-surface p-5">
        <MaterialIcon name="person_add" className="text-o-700" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">
            <Trans>¿Entró alguien nuevo a tu equipo?</Trans>
          </span>
          <span className="block text-xs text-ink-3">
            <Trans>
              Invítalo desde aquí y le llega su acceso. Un gerente nuevo lo confirma Oranje antes de
              que pueda entrar.
            </Trans>
          </span>
        </span>
        <Button variant="primary" onClick={(): void => setIsOpen(true)}>
          {t`Invitar cuenta`}
        </Button>
      </section>

      <HotelUserFormDialog
        isOpen={isOpen}
        onClose={(): void => setIsOpen(false)}
        user={null}
        /* Su hotel y nada más: el servidor rechaza cualquier otro, y ofrecer
           una lista que no se puede usar sería mentir. */
        hotels={[{ id: hotel.id, name: hotel.name }]}
        departments={[]}
      />
    </>
  )
}
