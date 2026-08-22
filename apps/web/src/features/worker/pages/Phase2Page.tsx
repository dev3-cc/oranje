import { useEffect, useState, type ReactNode } from 'react'

import { useCompleteSignupMutation, useGetMyProfileQuery } from '../api/workerApi'
import { TaxDeadlineBanner } from '../components/TaxDeadlineBanner'

import { Button } from '@/shared/components/Button'
import { TRANSPORT_LABEL, TRANSPORT_TYPES } from '@/shared/constants/workerEnums'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink focus:border-o-500 focus:outline-none'

/**
 * Alta · Fase 2 (RF-C-01, cambio del 2026-08-22): solo queda el TRANSPORTE y
 * el SSN/ITIN con su plazo de 3 días — posición, modalidad, inglés y
 * experiencia son decisiones de Oranje y las capturó la Reclutadora en la
 * entrevista. La foto también es de la Fase 1.
 */
export function Phase2Page(): ReactNode {
  const { data: profile } = useGetMyProfileQuery()
  const [save, { isLoading, isError, isSuccess }] = useCompleteSignupMutation()

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
      /* el error queda en `isError` */
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold text-ink">Alta · Fase 2</h1>
        <p className="mt-1 text-xs text-ink-3">
          RF-C-01 · transporte e identificación fiscal{' '}
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

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-3">
            ¿Cómo te trasladas?
            {IS_DEV_UI && <code className="text-xs text-ink-4"> · transport_type</code>}
          </span>
          <select
            value={transportType}
            onChange={(event) => {
              setTransportType(event.target.value)
            }}
            className={CONTROL_CLASS}
          >
            <option value="">Elige tu transporte…</option>
            {TRANSPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {TRANSPORT_LABEL[type]}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-4">
        <h2 className="text-sm font-semibold text-ink">SSN / ITIN</h2>

        {profile && <TaxDeadlineBanner deadline={profile.taxDeadline} />}

        {/* El campo cifrado sigue sin conectarse (D-27) y la carga del documento
            desde la app aún no tiene endpoint propio: se dice, no se finge. */}
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
          No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}

      <p className="text-center text-xs text-ink-4">
        Sigues en BLANCO hasta que la Reclutadora valide el alta (RF-08)
      </p>
    </div>
  )
}
