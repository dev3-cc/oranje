import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { useGetSessionQuery } from '@/app/sessionApi'
import { HotelUserFormDialog } from '@/features/admin'
import { useCan } from '@/shared/hooks/useCan'

/**
 * El hotel invita a su propia gente, como en el Inicio del hotel en el web
 * (`InviteHotelAccountCard`): mismos textos y el MISMO diálogo
 * (`HotelUserFormDialog`, que la feature exporta). Quién alcanza a qué rol lo
 * decide el servidor; un gerente nuevo lo confirma Oranje antes de entrar.
 */
export function InviteAccountCard(): ReactNode {
  const { t } = useLingui()
  const can = useCan()
  const { data: session } = useGetSessionQuery()
  const [isOpen, setIsOpen] = useState(false)

  const hotel = session?.hotel
  if (!can('users:invite_hotel') || !hotel) return null

  return (
    <>
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
          <MaterialIcon name="person_add" className="text-o-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              <Trans>¿Entró alguien nuevo a tu equipo?</Trans>
            </p>
            <p className="text-xs text-ink-3">
              <Trans>
                Invítalo desde aquí y le llega su acceso. Un gerente nuevo lo confirma Oranje antes
                de que pueda entrar.
              </Trans>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsOpen(true)
          }}
          className="min-h-11 rounded-xl bg-o-300 px-4 text-sm font-semibold text-ink shadow-xs active:bg-o-400"
        >
          {t`Invitar cuenta`}
        </button>
      </section>
      <HotelUserFormDialog
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false)
        }}
        user={null}
        /* Su hotel y nada más: el servidor rechaza cualquier otro (igual que el web). */
        hotels={[{ id: hotel.id, name: hotel.name }]}
        departments={[]}
      />
    </>
  )
}
