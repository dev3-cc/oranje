import { useEffect, useState, type ReactNode } from 'react'

import { useCompleteSignupMutation, useGetMyProfileQuery } from '../api/workerApi'

import mascotaFeliz from '@/assets/mascota/mascota-feliz.png'
import { Button } from '@/shared/components/Button'
import { isCompletePhone, PhoneInput } from '@/shared/components/PhoneInput'
import { Select } from '@/shared/components/Select'
import {
  BLOOD_LABEL,
  BLOOD_TYPES,
  RELATIONSHIP_LABEL,
  RELATIONSHIPS,
} from '@/shared/constants/workerEnums'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 transition-colors hover:border-ink-4 focus:outline-none focus-visible:border-o-500 focus-visible:ring-2 focus-visible:ring-o-500/30'

function Field({
  label,
  column,
  children,
}: {
  label: string
  column: string
  children: ReactNode
}): ReactNode {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-ink-3">
        {label}
        {IS_DEV_UI && <code className="text-xs text-ink-4"> · {column}</code>}
      </span>
      {children}
    </label>
  )
}

export function Phase3Page(): ReactNode {
  const { data: profile } = useGetMyProfileQuery()
  const [save, { isLoading, isError, isSuccess, error: saveError }] = useCompleteSignupMutation()

  const [draft, setDraft] = useState({
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    bloodType: '',
    medicalNotes: '',
  })

  useEffect(() => {
    if (!profile) return
    setDraft((previous) => ({
      ...previous,
      emergencyContactName: profile.emergencyContact?.name ?? '',
      emergencyContactPhone: profile.emergencyContact?.phone ?? '',
      emergencyContactRelationship: profile.emergencyContact?.relationship ?? '',
      bloodType: profile.bloodType ?? '',
    }))
  }, [profile])

  const update =
    (key: keyof typeof draft) =>
    (value: string): void => {
      setDraft((previous) => ({ ...previous, [key]: value }))
    }

  const canSubmit =
    draft.emergencyContactName.trim() !== '' &&
    isCompletePhone(draft.emergencyContactPhone) &&
    draft.emergencyContactRelationship !== '' &&
    draft.bloodType !== '' &&
    !isLoading

  const missingHint =
    draft.emergencyContactName.trim() === ''
      ? 'Falta el nombre del contacto de emergencia'
      : !isCompletePhone(draft.emergencyContactPhone)
        ? 'El teléfono de emergencia necesita al menos 7 dígitos (sin la lada)'
        : draft.emergencyContactRelationship === ''
          ? 'Elige el parentesco'
          : draft.bloodType === ''
            ? 'Elige el tipo de sangre'
            : null

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      await save({
        emergencyContactName: draft.emergencyContactName.trim(),
        emergencyContactPhone: draft.emergencyContactPhone.trim(),
        emergencyContactRelationship: draft.emergencyContactRelationship,
        bloodType: draft.bloodType,
        ...(draft.medicalNotes.trim() !== '' ? { medicalNotes: draft.medicalNotes.trim() } : {}),
      }).unwrap()
    } catch {
      return
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold text-ink">Alta · Fase 3</h1>
        <p className="mt-1 text-xs text-ink-3">
          RF-C-02 · emergencia y salud{' '}
          <span className="rounded-full bg-o-50 px-2 py-0.5 font-semibold text-o-700">
            Fase 3 de 3
          </span>
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-ink">Contacto de emergencia</h2>

        <Field label="Nombre" column="emergency_contact_name">
          <input
            value={draft.emergencyContactName}
            onChange={(event) => {
              update('emergencyContactName')(event.target.value)
            }}
            placeholder="Rubén Sandoval"
            className={CONTROL_CLASS}
          />
        </Field>

        <Field label="Teléfono" column="emergency_contact_phone">
          <PhoneInput
            value={draft.emergencyContactPhone}
            onChange={(value) => {
              update('emergencyContactPhone')(value)
            }}
            ariaLabel="Teléfono"
            placeholder="404 512 8890"
          />
        </Field>

        <Field label="Parentesco" column="emergency_contact_relationship">
          <Select
            value={draft.emergencyContactRelationship}
            onChange={(event) => {
              update('emergencyContactRelationship')(event.target.value)
            }}
            className={CONTROL_CLASS}
          >
            <option value="">¿Qué es de ti?</option>
            {RELATIONSHIPS.map((relationship) => (
              <option key={relationship} value={relationship}>
                {RELATIONSHIP_LABEL[relationship]}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="flex flex-col gap-4 border-t border-line pt-4">
        <h2 className="text-sm font-semibold text-ink">Salud</h2>

        <Field label="Tipo de sangre" column="blood_type · valores del CHECK (D-26)">
          <Select
            value={draft.bloodType}
            onChange={(event) => {
              update('bloodType')(event.target.value)
            }}
            className={CONTROL_CLASS}
          >
            <option value="">Elige tu tipo…</option>
            {BLOOD_TYPES.map((type) => (
              <option key={type} value={type}>
                {BLOOD_LABEL[type]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Alergias o condiciones médicas" column="medical_notes">
          <textarea
            value={draft.medicalNotes}
            onChange={(event) => {
              update('medicalNotes')(event.target.value)
            }}
            rows={3}
            placeholder="Ninguna"
            className={CONTROL_CLASS}
          />
        </Field>
      </section>

      {missingHint !== null && <p className="text-xs text-ink-3">{missingHint}</p>}
      <Button
        variant="primary"
        disabled={!canSubmit}
        onClick={() => {
          void submit()
        }}
      >
        {isLoading ? 'Guardando…' : 'Guardar'}
      </Button>

      {isSuccess && (
        <div className="flex items-center gap-3 rounded-md bg-green/10 px-4 py-3">
          <img src={mascotaFeliz} alt="" aria-hidden className="h-16 w-auto" />
          <p className="text-sm text-ink-2">
            Listo: tu expediente quedó completo. La Reclutadora lo validará
            {IS_DEV_UI ? ' (RF-08)' : ''}.
          </p>
        </div>
      )}
      {isError && (
        <p role="alert" className="text-sm text-red">
          {apiErrorMessage(saveError, { fallback: 'No se pudo guardar la Fase 3.' })}
        </p>
      )}
    </div>
  )
}
