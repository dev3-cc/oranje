import { Trans, useLingui } from '@lingui/react/macro'
import {
  MaterialIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useCompleteSignupMutation, useGetMyProfileQuery } from '../api/workerApi'
import { PhotoUploader } from '../components/PhotoUploader'
import { TaxDeadlineBanner } from '../components/TaxDeadlineBanner'
import { TaxDocumentUploader } from '../components/TaxDocumentUploader'

import { Button, buttonClass } from '@/shared/components/Button'
import { StepIndicator } from '@/shared/components/StepIndicator'
import { TRANSPORT_LABEL, TRANSPORT_TYPES } from '@/shared/constants/workerEnums'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const LAST_STEP = 3

/**
 * Tres pasos, como el alta de requisición: foto (opcional) → transporte
 * (lo único que de verdad bloquea) → SSN/ITIN (se sube solo, sin bloquear).
 * Antes las tres secciones vivían en un solo scroll y se sentían un
 * formulario largo; separarlas en pasos es lo que Hugo pidió (2026-09-29).
 */
export function Phase2Page(): ReactNode {
  const { t } = useLingui()
  const { data: profile } = useGetMyProfileQuery()
  const [save, { isLoading, isError, error: saveError }] = useCompleteSignupMutation()

  const [step, setStep] = useState(1)
  const [transportType, setTransportType] = useState('')

  const hasDocument = profile?.taxDeadline.hasDocument ?? false

  useEffect(() => {
    if (profile?.transportType) setTransportType(profile.transportType)
  }, [profile])

  const canSubmit = transportType !== '' && !isLoading

  async function submitTransport(): Promise<boolean> {
    if (!canSubmit) return false
    try {
      await save({ transportType }).unwrap()
      toast.success(t`Transporte guardado`)
      return true
    } catch {
      return false
    }
  }

  async function goNext(): Promise<void> {
    if (step === 2) {
      const saved = await submitTransport()
      if (!saved) return
    }
    setStep((current) => Math.min(LAST_STEP, current + 1))
  }

  const steps = [
    { step: 1, label: t`Tu foto` },
    { step: 2, label: t`Transporte` },
    { step: 3, label: t`SSN / ITIN` },
  ]

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

      <StepIndicator steps={steps} current={step} onStepClick={setStep} />

      {step === 1 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <MaterialIcon name="photo_camera" className="text-lg text-o-700" aria-hidden />
            <h2 className="text-sm font-semibold text-ink">
              <Trans>Tu foto</Trans>
            </h2>
          </div>
          <p className="text-xs text-ink-3">
            <Trans>
              Si tu Reclutadora no te la tomó en la entrevista, súbela tú. Se guarda al elegirla.
            </Trans>
          </p>
          <PhotoUploader photoUrl={profile?.photoUrl ?? null} />
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <MaterialIcon name="directions_car" className="text-lg text-o-700" aria-hidden />
            <h2 className="text-sm font-semibold text-ink">
              <Trans>Transporte</Trans>
            </h2>
          </div>

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

          {transportType === '' && (
            <p className="text-xs text-ink-3">
              <Trans>Elige tu transporte para continuar</Trans>
            </p>
          )}
          {isError && (
            <p role="alert" className="text-sm text-red">
              {apiErrorMessage(saveError, { fallback: t`No se pudo guardar el transporte.` })}
            </p>
          )}
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <MaterialIcon name="badge" className="text-lg text-o-700" aria-hidden />
            <h2 className="text-sm font-semibold text-ink">
              <Trans>SSN / ITIN</Trans>
            </h2>
          </div>

          {profile && <TaxDeadlineBanner deadline={profile.taxDeadline} />}

          <TaxDocumentUploader hasDocument={hasDocument} />

          {/* Un solo camino para seguir: el botón «Terminar» de abajo. Antes
              también había un enlace aquí que hacía lo mismo (Hugo, 2026-09-29). */}
          <p className="mt-2 rounded-md bg-green/10 px-4 py-3 text-sm text-ink-2">
            <Trans>Tu transporte quedó guardado.</Trans>
          </p>
        </section>
      )}

      <div className="flex gap-3">
        {step > 1 && (
          <Button
            onClick={() => {
              setStep((current) => current - 1)
            }}
          >
            <Trans>Atrás</Trans>
          </Button>
        )}
        {step < LAST_STEP ? (
          <Button
            variant="primary"
            disabled={step === 2 && !canSubmit}
            onClick={() => {
              void goNext()
            }}
          >
            {step === 2 && isLoading ? t`Guardando…` : t`Continuar`}
          </Button>
        ) : (
          <Link to="/colaborador/alta-3" className={buttonClass('primary', 'flex-1 text-center')}>
            <Trans>Terminar</Trans>
          </Link>
        )}
      </div>

      <p className="text-center text-xs text-ink-4">
        <Trans>Sigues en Blanco hasta que la Reclutadora valide el alta</Trans>
        {IS_DEV_UI ? ' (RF-08)' : ''}
      </p>
    </div>
  )
}
