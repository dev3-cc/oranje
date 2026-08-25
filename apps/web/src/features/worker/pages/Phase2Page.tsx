import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useCompleteSignupMutation, useGetMyProfileQuery } from '../api/workerApi'
import { TaxDeadlineBanner } from '../components/TaxDeadlineBanner'

import { Button } from '@/shared/components/Button'
import { TRANSPORT_LABEL, TRANSPORT_TYPES } from '@/shared/constants/workerEnums'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

export function Phase2Page(): ReactNode {
  const { data: profile } = useGetMyProfileQuery()
  const [save, { isLoading, isError, isSuccess, error: saveError }] = useCompleteSignupMutation()

  const [transportType, setTransportType] = useState('')

  useEffect(() => {
    if (profile?.transportType) setTransportType(profile.transportType)
  }, [profile])

  const canSubmit = transportType !== '' && !isLoading

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      await save({ transportType }).unwrap()
    } catch {
      return
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold text-ink">Alta · Fase 2</h1>
        <p className="mt-1 text-xs text-ink-3">
          {IS_DEV_UI
            ? 'RF-C-01 · transporte e identificación fiscal'
            : 'Transporte e identificación fiscal'}{' '}
          <span className="rounded-full bg-o-50 px-2 py-0.5 font-semibold text-o-700">
            Fase 2 de 3
          </span>
        </p>
      </header>

      {profile?.position && (
        <p className="rounded-md bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-3">
          Tu posición ({profile.position.name}), modalidad ({profile.hiringModality?.name ?? '—'}) y
          nivel de inglés ({profile.englishLevel?.name ?? '—'}) los definió Oranje en tu entrevista.
          Si algo no cuadra, coméntalo con tu Reclutadora.
        </p>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-ink">Transporte</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="transportType" className="text-sm text-ink-3">
            ¿Cómo te trasladas?
            {IS_DEV_UI && <code className="text-xs text-ink-4"> · transport_type</code>}
          </label>
          <Select
            {...(transportType ? { value: transportType } : {})}
            onValueChange={setTransportType}
          >
            <SelectTrigger id="transportType" className="w-full">
              <SelectValue placeholder="Elige tu transporte…" />
            </SelectTrigger>
            <SelectContent>
              {TRANSPORT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {TRANSPORT_LABEL[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-4">
        <h2 className="text-sm font-semibold text-ink">SSN / ITIN</h2>

        {profile && <TaxDeadlineBanner deadline={profile.taxDeadline} />}

        {}
        <div className="flex items-center justify-between rounded-md bg-surface-2 px-4 py-3">
          <span className="text-sm text-ink-2">Subir SSN / ITIN desde la app</span>
          <span className="rounded-full border border-dashed border-ink-4 px-2.5 py-0.5 text-xs text-ink-3">
            pendiente
          </span>
        </div>
        <p className="text-xs text-ink-4">
          Mientras tanto, entrégalo a tu Reclutadora: ella lo sube a tu expediente.
        </p>
      </section>

      {transportType === '' && (
        <p className="text-xs text-ink-3">Elige tu transporte para poder enviar</p>
      )}
      <Button
        variant="primary"
        disabled={!canSubmit}
        onClick={() => {
          void submit()
        }}
      >
        {isLoading ? 'Enviando…' : 'Enviar'}
      </Button>

      {isSuccess && (
        <p className="rounded-md bg-green/10 px-4 py-3 text-sm text-ink-2">
          Transporte guardado. Sigue la Fase 3.
        </p>
      )}
      {isError && (
        <p role="alert" className="text-sm text-red">
          {apiErrorMessage(saveError, { fallback: 'No se pudo guardar el transporte.' })}
        </p>
      )}

      <p className="text-center text-xs text-ink-4">
        Sigues en Blanco hasta que la Reclutadora valide el alta{IS_DEV_UI ? ' (RF-08)' : ''}
      </p>
    </div>
  )
}
