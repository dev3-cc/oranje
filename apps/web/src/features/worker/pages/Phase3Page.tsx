import { useEffect, useState, type ReactNode } from 'react'

import { useCompleteSignupMutation, useGetMyProfileQuery } from '../api/workerApi'

import { Button } from '@/shared/components/Button'
import {
  BLOOD_LABEL,
  BLOOD_TYPES,
  RELATIONSHIP_LABEL,
  RELATIONSHIPS,
} from '@/shared/constants/workerEnums'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none'

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

/**
 * Alta · Fase 3 (RF-C-02, maqueta móvil): contacto de emergencia y salud —
 * los 4 campos restantes de `is_profile_complete` más las notas médicas.
 */
export function Phase3Page(): ReactNode {
  const { data: profile } = useGetMyProfileQuery()
  const [save, { isLoading, isError, isSuccess }] = useCompleteSignupMutation()

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
    draft.emergencyContactPhone.trim().length >= 7 &&
    draft.emergencyContactRelationship !== '' &&
    draft.bloodType !== '' &&
    !isLoading

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      await save({
        emergencyContactName: draft.emergencyContactName.trim(),
        emergencyContactPhone: draft.emergencyContactPhone.trim(),
        emergencyContactRelationship: draft.emergencyContactRelationship,
        bloodType: draft.bloodType,
        /** El DTO no acepta null: vacío se omite, no se manda. */
        ...(draft.medicalNotes.trim() !== '' ? { medicalNotes: draft.medicalNotes.trim() } : {}),
      }).unwrap()
    } catch {
      /* el error queda en `isError` */
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
          <input
            value={draft.emergencyContactPhone}
            onChange={(event) => {
              update('emergencyContactPhone')(event.target.value)
            }}
            placeholder="+1 404 512 8890"
            className={CONTROL_CLASS}
          />
        </Field>

        <Field label="Parentesco" column="emergency_contact_relationship">
          <select
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
          </select>
        </Field>
      </section>

      <section className="flex flex-col gap-4 border-t border-line pt-4">
        <h2 className="text-sm font-semibold text-ink">Salud</h2>

        <Field label="Tipo de sangre" column="blood_type · valores del CHECK (D-26)">
          <select
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
          </select>
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
        <p className="rounded-md bg-green/10 px-4 py-3 text-sm text-ink-2">
          Listo: tu expediente quedó completo. La Reclutadora lo validará (RF-08).
        </p>
      )}
      {isError && (
        <p role="alert" className="text-sm text-red">
          No se pudo guardar. Inténtalo de nuevo.
        </p>
      )}
    </div>
  )
}
