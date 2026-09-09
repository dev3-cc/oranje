import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  MaterialIcon,
} from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { useGetAuditsHotelQuery } from '../api/auditsApi'

import { AuditWorkerList } from './AuditWorkerList'
import { EnvironmentAuditDialog } from './EnvironmentAuditDialog'
import { PersonalPresentationAuditDialog } from './PersonalPresentationAuditDialog'

import { Button } from '@/shared/components/Button'
import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
import { MagicCard } from '@/shared/components/MagicCard'
import { IS_DEV_UI } from '@/shared/lib/devMode'

type OpenPath = 'ENVIRONMENT' | 'WORKER_LIST' | 'PERSONAL'

/**
 * SU hotel, como tarjeta con el hero de foto (mismo lenguaje que la ficha de
 * Mi Personal y el tablero de Requisiciones): un Supervisor tiene UN SOLO
 * hotel (`identity.user.hotelId`), así que aquí no hay grid — es una tarjeta
 * ancha con las dos auditorías detrás de "Auditar".
 */
export function AuditHotelCard({
  hotelId,
  hotelName,
  canCreate,
}: {
  hotelId: string
  hotelName: string
  canCreate: boolean
}): ReactNode {
  const { data: hotel } = useGetAuditsHotelQuery(hotelId)
  const [open, setOpen] = useState<OpenPath | null>(null)
  const [worker, setWorker] = useState<{
    id: string
    fullName: string
    photoUrl: string | null
  } | null>(null)

  return (
    <>
      <MagicCard className="rounded-2xl">
        {/* Un solo hero (patrón de la ficha de Mi Personal): título, acción y
            estado viven DENTRO del cristal sobre la foto — nada de una barra
            blanca aparte, que a lo ancho del shell se veía vacía. */}
        <div className="relative overflow-hidden rounded-2xl shadow-md">
          <HotelPhotoBackdrop photoUrl={hotel?.photoUrl ?? null} />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-ink/25 via-ink/45 to-ink/70"
          />
          <div className="relative flex flex-wrap items-end justify-between gap-4 p-5">
            <div>
              <p className="text-2xl font-bold text-white">{hotelName}</p>
              <p className="text-xs text-white/80">
                Tu hotel
                {IS_DEV_UI && <span> · supervision.audit</span>}
              </p>
            </div>
            {canCreate ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="primary">
                    <MaterialIcon name="fact_check" className="text-base" aria-hidden />
                    Auditar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setOpen('WORKER_LIST')
                    }}
                  >
                    <MaterialIcon name="badge" className="text-base" aria-hidden />
                    Auditoría de personal
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setOpen('ENVIRONMENT')
                    }}
                  >
                    <MaterialIcon name="apartment" className="text-base" aria-hidden />
                    Auditar por ambiente
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <p className="max-w-xs text-right text-xs text-white/80">
                Las auditorías las hace el Supervisor del hotel; tú puedes ver el historial.
              </p>
            )}
          </div>
        </div>
      </MagicCard>

      {open === 'WORKER_LIST' && (
        <AuditWorkerList
          hotelId={hotelId}
          onSelect={(picked) => {
            setWorker(picked)
            setOpen('PERSONAL')
          }}
          onClose={() => {
            setOpen(null)
          }}
        />
      )}

      {open === 'PERSONAL' && worker && (
        <PersonalPresentationAuditDialog
          hotelId={hotelId}
          worker={worker}
          onClose={() => {
            setOpen(null)
            setWorker(null)
          }}
        />
      )}

      {open === 'ENVIRONMENT' && (
        <EnvironmentAuditDialog
          hotelId={hotelId}
          hotelName={hotelName}
          onClose={() => {
            setOpen(null)
          }}
        />
      )}
    </>
  )
}
