import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useCompleteSignupMutation, useGetMyProfileQuery } from '../api/workerApi'

import mascotaFeliz from '@/assets/mascota/mascota-feliz.png'
import { Button } from '@/shared/components/Button'
import { isCompletePhone, PhoneInput } from '@/shared/components/PhoneInput'
import {
  BLOOD_LABEL,
  BLOOD_TYPES,
  RELATIONSHIP_LABEL,
  RELATIONSHIPS,
} from '@/shared/constants/workerEnums'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

function Field({
  label,
  htmlFor,
  column,
  children,
}: {
  label: string
  htmlFor?: string
  column: string
  children: ReactNode
}): ReactNode {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm text-ink-3">
        {label}
        {IS_DEV_UI && <code className="text-xs text-ink-4"> · {column}</code>}
      </label>
      {children}
    </div>
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
      toast.success('Datos de emergencia guardados')
    } catch {
      return
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold text-ink">Por si algo pasa</h1>
        <p className="mt-1 text-xs text-ink-3">
          {IS_DEV_UI ? 'RF-C-02 · emergencia y salud' : 'A quién llamamos y qué debemos saber'}{' '}
          <span className="rounded-full bg-o-50 px-2 py-0.5 font-semibold text-o-700">
            Paso 2 de 2
          </span>
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-ink">Contacto de emergencia</h2>

        <Field label="Nombre" htmlFor="emergencyContactName" column="emergency_contact_name">
          <Input
            id="emergencyContactName"
            value={draft.emergencyContactName}
            onChange={(event) => {
              update('emergencyContactName')(event.target.value)
            }}
            placeholder="Rubén Sandoval"
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

        <Field
          label="Parentesco"
          htmlFor="emergencyContactRelationship"
          column="emergency_contact_relationship"
        >
          <Select
            {...(draft.emergencyContactRelationship
              ? { value: draft.emergencyContactRelationship }
              : {})}
            onValueChange={update('emergencyContactRelationship')}
          >
            <SelectTrigger id="emergencyContactRelationship" className="w-full">
              <SelectValue placeholder="¿Qué es de ti?" />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIPS.map((relationship) => (
                <SelectItem key={relationship} value={relationship}>
                  {RELATIONSHIP_LABEL[relationship]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </section>

      <section className="flex flex-col gap-4 border-t border-line pt-4">
        <h2 className="text-sm font-semibold text-ink">Salud</h2>

        <Field
          label="Tipo de sangre"
          htmlFor="bloodType"
          column="blood_type · valores del CHECK (D-26)"
        >
          <Select
            {...(draft.bloodType ? { value: draft.bloodType } : {})}
            onValueChange={update('bloodType')}
          >
            <SelectTrigger id="bloodType" className="w-full">
              <SelectValue placeholder="Elige tu tipo…" />
            </SelectTrigger>
            <SelectContent>
              {BLOOD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {BLOOD_LABEL[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Alergias o condiciones médicas" htmlFor="medicalNotes" column="medical_notes">
          <Textarea
            id="medicalNotes"
            value={draft.medicalNotes}
            onChange={(event) => {
              update('medicalNotes')(event.target.value)
            }}
            rows={3}
            placeholder="Ninguna"
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
          {apiErrorMessage(saveError, {
            fallback: 'No se pudieron guardar tus datos. Inténtalo de nuevo.',
          })}
        </p>
      )}
    </div>
  )
}
