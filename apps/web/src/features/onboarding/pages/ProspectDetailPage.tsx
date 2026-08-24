import { StatusLightBadge } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import { useDeleteContactAttemptMutation, useGetProspectQuery } from '../api/onboardingApi'
import { useGetProposalWorkspaceQuery } from '../api/proposalsApi'
import { ChangeStatusDialog } from '../components/ChangeStatusDialog'
import { ContactAttemptLog } from '../components/ContactAttemptLog'
import { HotelContactList } from '../components/HotelContactList'
import { HotelContactsDialog } from '../components/HotelContactsDialog'
import { HotelDataCard } from '../components/HotelDataCard'
import { ProposalVersionList } from '../components/ProposalVersionList'
import { ProspectFormDialog } from '../components/ProspectFormDialog'
import { RegisterAttemptDialog } from '../components/RegisterAttemptDialog'
import { StatusTimeline } from '../components/StatusTimeline'
import type { ContactAttempt } from '../types/prospect.types'

import { useGetSessionQuery } from '@/app/sessionApi'
import { Button } from '@/shared/components/Button'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import {
  isTerminalStatus,
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { formatDate } from '@/shared/lib/formatters'

export function ProspectDetailPage(): ReactNode {
  const { prospectId = '' } = useParams()
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [attemptToEdit, setAttemptToEdit] = useState<ContactAttempt | null>(null)
  const { data: session } = useGetSessionQuery()
  const [deleteAttempt] = useDeleteContactAttemptMutation()
  const [isAttemptDialogOpen, setIsAttemptDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [areContactsOpen, setAreContactsOpen] = useState(false)
  /** La URL guardada de Places pudo caducar (getUrl es efímera): hero sin foto. */
  const [isPhotoDead, setPhotoDead] = useState(false)

  const {
    data: prospect,
    isLoading,
    isError,
  } = useGetProspectQuery(prospectId, { skip: prospectId === '' })

  /**
   * Las propuestas se piden aparte, al mismo endpoint que usa el editor. Es una
   * petición más, pero evita que la ficha y el editor muestren versiones
   * distintas del mismo hotel.
   */
  const { data: proposals, isLoading: areProposalsLoading } = useGetProposalWorkspaceQuery(
    prospectId,
    { skip: prospectId === '' },
  )

  if (isLoading) {
    return <DetailSkeleton />
  }

  if (isError || !prospect) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-red">No se encontró el prospecto.</p>
        <Link to="/pipeline" className="text-sm font-semibold text-o-700 hover:underline">
          Volver al pipeline
        </Link>
      </div>
    )
  }

  const statusLabel = ONBOARDING_STATUS_LABEL[prospect.status]

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="flex items-center gap-2 text-sm text-ink-3">
        <Link to="/pipeline" className="hover:text-o-700">
          Pipeline
        </Link>
        <span aria-hidden>›</span>
        <span className="text-ink-2">{prospect.hotelName}</span>
      </nav>

      {/* Con foto (Places, persistida): hero con fundido al fondo de la página. */}
      {prospect.hotel.photoUrl && !isPhotoDead ? (
        <header className="relative overflow-hidden rounded-xl">
          <img
            src={prospect.hotel.photoUrl}
            alt={`Foto de ${prospect.hotelName} según Google`}
            className="h-72 w-full object-cover"
            onError={() => {
              setPhotoDead(true)
            }}
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-b from-transparent via-bg/85 to-bg"
          />
          <div className="absolute top-4 right-4">
            <div className="flex items-center gap-3">
              {/* Abre el MISMO modal del alta, en modo edición: un solo formulario. */}
              <button
                type="button"
                aria-label="Editar la información del cliente"
                title="Editar la información del cliente"
                onClick={() => {
                  setIsEditDialogOpen(true)
                }}
                className="flex size-10 shrink-0 items-center justify-center rounded-md border border-line text-ink-3 transition-colors hover:bg-surface-2 hover:text-o-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
              >
                <span className="material-icons-outlined text-xl leading-none" aria-hidden>
                  edit
                </span>
              </button>
              <Button
                onClick={() => {
                  setIsAttemptDialogOpen(true)
                }}
              >
                Registrar intento
              </Button>
              {/*
            Un estado terminal no tiene a dónde ir: `NARANJA` es un cliente
            activo y `ROJO` un rechazo, y ninguno declara transiciones. Abrir el
            diálogo solo para enseñar una lista vacía es peor que no ofrecerlo.
          */}
              <Button
                variant="primary"
                disabled={isTerminalStatus(prospect.status)}
                title={
                  isTerminalStatus(prospect.status)
                    ? `${statusLabel} es un estado final: no admite más cambios`
                    : undefined
                }
                onClick={() => {
                  setIsStatusDialogOpen(true)
                }}
              >
                Cambiar estado
              </Button>
            </div>
          </div>
          <div className="absolute inset-x-6 bottom-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-ink">{prospect.hotelName}</h1>
                <StatusLightBadge
                  token={ONBOARDING_STATUS_TOKEN[prospect.status]}
                  label={statusLabel}
                />
              </div>
              <p className="mt-1.5 text-sm text-ink-3">
                Ciclo abierto desde {formatDate(prospect.cycleStartedAt)} · {prospect.daysInStatus}{' '}
                días en {statusLabel} · Dueño: {prospect.owner.name}
              </p>
            </div>
          </div>
        </header>
      ) : (
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-ink">{prospect.hotelName}</h1>
              <StatusLightBadge
                token={ONBOARDING_STATUS_TOKEN[prospect.status]}
                label={statusLabel}
              />
            </div>
            <p className="mt-1.5 text-sm text-ink-3">
              Ciclo abierto desde {formatDate(prospect.cycleStartedAt)} · {prospect.daysInStatus}{' '}
              días en {statusLabel} · Dueño: {prospect.owner.name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Abre el MISMO modal del alta, en modo edición: un solo formulario. */}
            <button
              type="button"
              aria-label="Editar la información del cliente"
              title="Editar la información del cliente"
              onClick={() => {
                setIsEditDialogOpen(true)
              }}
              className="flex size-10 shrink-0 items-center justify-center rounded-md border border-line text-ink-3 transition-colors hover:bg-surface-2 hover:text-o-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
            >
              <span className="material-icons-outlined text-xl leading-none" aria-hidden>
                edit
              </span>
            </button>
            <Button
              onClick={() => {
                setIsAttemptDialogOpen(true)
              }}
            >
              Registrar intento
            </Button>
            {/*
            Un estado terminal no tiene a dónde ir: `NARANJA` es un cliente
            activo y `ROJO` un rechazo, y ninguno declara transiciones. Abrir el
            diálogo solo para enseñar una lista vacía es peor que no ofrecerlo.
          */}
            <Button
              variant="primary"
              disabled={isTerminalStatus(prospect.status)}
              title={
                isTerminalStatus(prospect.status)
                  ? `${statusLabel} es un estado final: no admite más cambios`
                  : undefined
              }
              onClick={() => {
                setIsStatusDialogOpen(true)
              }}
            >
              Cambiar estado
            </Button>
          </div>
        </header>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <HotelDataCard hotel={prospect.hotel} needDescription={prospect.needDescription} />
          <ContactAttemptLog
            attempts={prospect.attempts}
            sessionUserId={session?.id}
            onEdit={(attempt) => {
              setAttemptToEdit(attempt)
              setIsAttemptDialogOpen(true)
            }}
            onDelete={(attempt) => {
              void deleteAttempt({ prospectId: prospect.id, attemptId: attempt.id })
            }}
          />
          <ProposalVersionList
            prospectId={prospect.id}
            hotelName={prospect.hotelName}
            versions={proposals?.versions ?? []}
            isLoading={areProposalsLoading}
          />
        </div>

        <div className="flex flex-col gap-5">
          <HotelContactList
            contacts={prospect.contacts}
            onEdit={() => {
              setAreContactsOpen(true)
            }}
          />
          <StatusTimeline history={prospect.history} />
        </div>
      </div>

      <ProspectFormDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false)
        }}
        prospect={prospect}
      />

      <HotelContactsDialog
        isOpen={areContactsOpen}
        onClose={() => {
          setAreContactsOpen(false)
        }}
        prospectId={prospect.id}
        hotelName={prospect.hotelName}
        contacts={prospect.contacts}
      />

      <RegisterAttemptDialog
        isOpen={isAttemptDialogOpen}
        onClose={() => {
          setIsAttemptDialogOpen(false)
          setAttemptToEdit(null)
        }}
        prospectId={prospect.id}
        hotelName={prospect.hotelName}
        contacts={prospect.contacts}
        {...(attemptToEdit ? { attempt: attemptToEdit } : {})}
      />

      <ChangeStatusDialog
        isOpen={isStatusDialogOpen}
        onClose={() => {
          setIsStatusDialogOpen(false)
        }}
        prospectId={prospect.id}
        hotelName={prospect.hotelName}
        currentStatus={prospect.status}
      />
    </div>
  )
}
