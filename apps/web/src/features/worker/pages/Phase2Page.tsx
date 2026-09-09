import { Trans, useLingui } from '@lingui/react/macro'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useCompleteSignupMutation, useGetMyProfileQuery } from '../api/workerApi'
import { TaxDeadlineBanner } from '../components/TaxDeadlineBanner'
import { TaxDocumentUploader } from '../components/TaxDocumentUploader'

import { Button } from '@/shared/components/Button'
import { TRANSPORT_LABEL, TRANSPORT_TYPES } from '@/shared/constants/workerEnums'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

export function Phase2Page(): ReactNode {
  const { t } = useLingui()
  const { data: profile } = useGetMyProfileQuery()
  const [save, { isLoading, isError, isSuccess, error: saveError }] = useCompleteSignupMutation()

  const [transportType, setTransportType] = useState('')

  const hasDocument = profile?.taxDeadline.hasDocument ?? false

  useEffect(() => {
    if (profile?.transportType) setTransportType(profile.transportType)
  }, [profile])

  const canSubmit = transportType !== '' && !isLoading

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      await save({ transportType }).unwrap()
      toast.success(t`Transporte guardado`)
    } catch {
      return
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold text-ink">
          <Trans>Cómo llegas al trabajo</Trans>
        </h1>
        <p className="mt-1 text-xs text-ink-3">
          {IS_DEV_UI
            ? 'RF-C-01 · transporte e identificación fiscal'
            : t`Tu transporte y tu SSN o ITIN`}{' '}
          <span className="rounded-full bg-o-50 px-2 py-0.5 font-semibold text-o-700">
            <Trans>Paso 1 de 2</Trans>
          </span>
        </p>
      </header>

      {profile?.position && (
        <p className="rounded-md bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-3">
          <Trans>
            Tu posición ({profile.position.name}), modalidad ({profile.hiringModality?.name ?? '—'})
            y nivel de inglés ({profile.englishLevel?.name ?? '—'}) los definió Oranje en tu
            entrevista. Si algo no cuadra, coméntalo con tu Reclutadora.
          </Trans>
        </p>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-ink">
          <Trans>Transporte</Trans>
        </h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="transportType" className="text-sm text-ink-3">
            <Trans>¿Cómo te trasladas?</Trans>
            {IS_DEV_UI && <code className="text-xs text-ink-4"> · transport_type</code>}
          </label>
          <Select
            {...(transportType ? { value: transportType } : {})}
            onValueChange={setTransportType}
          >
            <SelectTrigger id="transportType" className="w-full">
              <SelectValue placeholder={t`Elige tu transporte…`} />
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
        <h2 className="text-sm font-semibold text-ink">
          <Trans>SSN / ITIN</Trans>
        </h2>

        {profile && <TaxDeadlineBanner deadline={profile.taxDeadline} />}

        <TaxDocumentUploader hasDocument={hasDocument} />
      </section>

      {transportType === '' && (
        <p className="text-xs text-ink-3">
          <Trans>Elige tu transporte para poder enviar</Trans>
        </p>
      )}
      <Button
        variant="primary"
        disabled={!canSubmit}
        onClick={() => {
          void submit()
        }}
      >
        {isLoading ? t`Enviando…` : t`Enviar`}
      </Button>

      {isSuccess && (
        <p className="rounded-md bg-green/10 px-4 py-3 text-sm text-ink-2">
          <Trans>Transporte guardado.</Trans>{' '}
          <Link to="/colaborador/alta-3" className="font-semibold text-o-700 underline">
            <Trans>Sigue con tu contacto de emergencia →</Trans>
          </Link>
        </p>
      )}
      {isError && (
        <p role="alert" className="text-sm text-red">
          {apiErrorMessage(saveError, { fallback: t`No se pudo guardar el transporte.` })}
        </p>
      )}

      <p className="text-center text-xs text-ink-4">
        <Trans>Sigues en Blanco hasta que la Reclutadora valide el alta</Trans>
        {IS_DEV_UI ? ' (RF-08)' : ''}
      </p>
    </div>
  )
}
