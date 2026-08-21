import { useEffect, useState, type ReactNode } from 'react'

import { useCreateWorkerMutation, useGetPoolOptionsQuery } from '../api/poolApi'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none'

const GENDERS = [
  { value: 'FEMALE', label: 'Femenino' },
  { value: 'MALE', label: 'Masculino' },
  { value: 'OTHER', label: 'Otro' },
] as const

/** Qué pasa después del alta: las cinco verdades de la maqueta, tal cual. */
const AFTERMATH = [
  'Nace en BLANCO: la fila existe a medias, eso ES el estado (D-26).',
  'El colaborador completa Fase 2 (perfil laboral y SSN/ITIN opcional) y Fase 3 (emergencia y salud) en la app.',
  'is_profile_complete vive en vw_worker: los campos obligatorios los declara la vista, sin NOT NULL.',
  'La Reclutadora valida el alta (RF-08) → pasa a VERDE FUERTE y entra al Pool.',
  'Sin SSN/ITIN, la retención del 16% aplica automática (D-27).',
]

interface Draft {
  fullName: string
  birthDate: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  phone: string
  address: string
  zoneId: string
}

const EMPTY_DRAFT: Draft = {
  fullName: '',
  birthDate: '',
  gender: 'FEMALE',
  phone: '',
  address: '',
  zoneId: '',
}

/**
 * Crear colaborador — Fase 1 · Entrevista (maqueta de la Reclutadora): solo la
 * identidad. El resto del expediente llega en fases por la app del colaborador,
 * y por eso la persona nace en BLANCO con el perfil incompleto — es el diseño,
 * no un hueco (`POST /workers`, D-26).
 */
export function CreateWorkerDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const { data: options } = useGetPoolOptionsQuery(undefined, { skip: !isOpen })
  const [createWorker, { isLoading, isError }] = useCreateWorkerMutation()

  useEffect(() => {
    if (isOpen) setDraft(EMPTY_DRAFT)
  }, [isOpen])

  const update =
    <K extends keyof Draft>(key: K) =>
    (value: Draft[K]): void => {
      setDraft((previous) => ({ ...previous, [key]: value }))
    }

  const canSubmit =
    draft.fullName.trim() !== '' &&
    draft.birthDate !== '' &&
    draft.phone.trim().length >= 7 &&
    draft.address.trim() !== '' &&
    draft.zoneId !== '' &&
    !isLoading

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      await createWorker({
        fullName: draft.fullName.trim(),
        birthDate: draft.birthDate,
        gender: draft.gender,
        phone: draft.phone.trim(),
        address: draft.address.trim(),
        zoneId: draft.zoneId,
      }).unwrap()
      onClose()
    } catch {
      /* el error queda en `isError` y se pinta abajo */
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Crear colaborador — Fase 1 · Entrevista"
      description={
        IS_DEV_UI
          ? 'personal.worker · nace en BLANCO'
          : 'Solo la identidad: el resto llega por la app'
      }
      className="max-w-3xl"
      footer={
        <>
          <Button onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => {
              void submit()
            }}
          >
            {isLoading ? 'Creando…' : 'Crear colaborador'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[3fr_2fr]">
        <fieldset className="flex flex-col gap-4">
          <legend className="text-sm font-semibold text-ink">Identidad</legend>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-3">
              Nombre completo{IS_DEV_UI && <code className="text-xs text-ink-4"> · full_name</code>}
            </span>
            <input
              value={draft.fullName}
              onChange={(event) => {
                update('fullName')(event.target.value)
              }}
              placeholder="María Sandoval Ruiz"
              className={CONTROL_CLASS}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-3">
                Fecha de nacimiento
                {IS_DEV_UI && <code className="text-xs text-ink-4"> · birth_date</code>}
              </span>
              <input
                type="date"
                value={draft.birthDate}
                onChange={(event) => {
                  update('birthDate')(event.target.value)
                }}
                aria-label="Fecha de nacimiento"
                className={CONTROL_CLASS}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-3">
                Género{IS_DEV_UI && <code className="text-xs text-ink-4"> · gender</code>}
              </span>
              <select
                value={draft.gender}
                onChange={(event) => {
                  update('gender')(event.target.value as Draft['gender'])
                }}
                aria-label="Género"
                className={CONTROL_CLASS}
              >
                {GENDERS.map((gender) => (
                  <option key={gender.value} value={gender.value}>
                    {gender.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-3">
                Teléfono{IS_DEV_UI && <code className="text-xs text-ink-4"> · phone</code>}
              </span>
              <input
                value={draft.phone}
                onChange={(event) => {
                  update('phone')(event.target.value)
                }}
                placeholder="+1 404 790 2517"
                className={CONTROL_CLASS}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-3">
                Zona{IS_DEV_UI && <code className="text-xs text-ink-4"> · zone_id</code>}
              </span>
              <select
                value={draft.zoneId}
                onChange={(event) => {
                  update('zoneId')(event.target.value)
                }}
                aria-label="Zona"
                className={CONTROL_CLASS}
              >
                <option value="">Elige la zona…</option>
                {(options?.zones ?? []).map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-3">
              Domicilio{IS_DEV_UI && <code className="text-xs text-ink-4"> · address</code>}
            </span>
            <input
              value={draft.address}
              onChange={(event) => {
                update('address')(event.target.value)
              }}
              placeholder="1280 Peachtree St NE, Atlanta"
              className={CONTROL_CLASS}
            />
          </label>
        </fieldset>

        <aside className="rounded-lg bg-surface-2 p-4">
          <h3 className="text-sm font-semibold text-ink">Qué pasa después</h3>
          <ul className="mt-2.5 flex flex-col gap-2.5">
            {AFTERMATH.map((line) => (
              <li key={line} className="flex gap-2.5 text-xs leading-relaxed text-ink-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-o-500" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {isError && (
        <p role="alert" className="text-sm text-red">
          No se pudo crear el colaborador. Revisa los datos e inténtalo de nuevo.
        </p>
      )}
    </Modal>
  )
}
