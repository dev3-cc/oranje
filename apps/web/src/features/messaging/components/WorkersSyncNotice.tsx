import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'

import { useGetWorkersSyncStatusQuery } from '../api/messagingWorkersSyncApi'

import { SYNC_WORKERS_PERMISSION } from './SyncWorkersButton'

import personajeConfiguracion from '@/assets/ilustrations/personaje-configuracion.svg'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { useCan } from '@/shared/hooks/useCan'

/**
 * Cuántos colaboradores faltan en la plataforma. Es lo que bloquea «Nueva
 * campaña»: solo los colaboradores NUEVOS bloquean; un cambio de
 * hotel o de estado no se detecta (Hugo, 2026-10-23: conteo, sin migración).
 * Si el estado no se puede leer, no bloquea: la plataforma manda.
 */
export function useWorkersSyncPending(): number {
  const can = useCan()
  const { data } = useGetWorkersSyncStatusQuery(undefined, {
    skip: !can(SYNC_WORKERS_PERMISSION),
  })
  return data?.configured === true ? data.pending : 0
}

export function WorkersSyncNotice({ pending }: { pending: number }): ReactNode {
  const { i18n } = useLingui()
  if (pending === 0) return null

  return (
    <NoticeCard
      tone="action"
      image={personajeConfiguracion}
      title={
        pending === 1
          ? i18n._(msg`1 colaborador nuevo sin sincronizar`)
          : i18n._(msg`${pending} colaboradores nuevos sin sincronizar`)
      }
    >
      <Trans>
        Usa «Sincronizar colaboradores» antes de crear una campaña: si no, no les llegaría.
      </Trans>
    </NoticeCard>
  )
}
