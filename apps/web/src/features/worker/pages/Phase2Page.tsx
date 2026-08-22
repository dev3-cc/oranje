import { useEffect, useState, type ReactNode } from 'react'

import {
  useGetMyProfileQuery,
  useGetWorkerCatalogsQuery,
  useUpdatePhase2Mutation,
} from '../api/workerApi'
import {
  EXPERIENCE_LABEL,
  EXPERIENCE_LEVELS,
  TRANSPORT_LABEL,
  TRANSPORT_TYPES,
} from '../types/worker.types'

import { Button } from '@/shared/components/Button'
import { PhotoUpload } from '@/shared/components/PhotoUpload'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink focus:border-o-500 focus:outline-none'

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
 * Alta · Fase 2 (RF-C-01, maqueta móvil): el perfil laboral — los 5 campos
 * que integran `is_profile_complete` — más la foto (que no integra) y el
 * SSN/ITIN, que sigue pendiente del cifrado (D-27) y se dice tal cual.
 */
export function Phase2Page(): ReactNode {
  const { data: profile } = useGetMyProfileQuery()
  const { data: options } = useGetWorkerCatalogsQuery()
  const [save, { isLoading, isError, isSuccess }] = useUpdatePhase2Mutation()

  const [draft, setDraft] = useState({
    catalogPositionId: '',
    englishLevelId: '',
    hiringModalityId: '',
    experienceLevel: '',
    transportType: '',
    photoPath: '',
  })

  useEffect(() => {
    if (!profile) return
    setDraft((previous) => ({
      ...previous,
      catalogPositionId: profile.catalogPositionId ?? '',
      englishLevelId: profile.englishLevelId ?? '',
      hiringModalityId: profile.hiringModalityId ?? '',
      experienceLevel: profile.experienceLevel ?? '',
      transportType: profile.transportType ?? '',
    }))
  }, [profile])

  const update =
    (key: keyof typeof draft) =>
    (value: string): void => {
      setDraft((previous) => ({ ...previous, [key]: value }))
    }

  const canSubmit =
    draft.catalogPositionId !== '' &&
    draft.englishLevelId !== '' &&
    draft.hiringModalityId !== '' &&
    draft.experienceLevel !== '' &&
    draft.transportType !== '' &&
    !isLoading

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      await save({
        catalogPositionId: draft.catalogPositionId,
        englishLevelId: draft.englishLevelId,
        hiringModalityId: draft.hiringModalityId,
        experienceLevel: draft.experienceLevel,
        transportType: draft.transportType,
        ...(draft.photoPath !== '' ? { photoPath: draft.photoPath } : {}),
      }).unwrap()
    } catch {
      /* el error queda en `isError` */
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold text-ink">Alta · Fase 2</h1>
        <p className="mt-1 text-xs text-ink-3">
          RF-C-01 · perfil laboral{' '}
          <span className="rounded-full bg-o-50 px-2 py-0.5 font-semibold text-o-700">
            Fase 2 de 3
          </span>
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-ink">Perfil laboral</h2>

        <Field label="Posición" column="catalog_position_id">
          <select
            value={draft.catalogPositionId}
            onChange={(event) => {
              update('catalogPositionId')(event.target.value)
            }}
            className={CONTROL_CLASS}
          >
            <option value="">Elige tu posición…</option>
            {(options?.positions ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Nivel de inglés" column="english_level_id">
          <select
            value={draft.englishLevelId}
            onChange={(event) => {
              update('englishLevelId')(event.target.value)
            }}
            className={CONTROL_CLASS}
          >
            <option value="">Elige tu nivel…</option>
            {(options?.englishLevels ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Experiencia" column="experience_level">
          <select
            value={draft.experienceLevel}
            onChange={(event) => {
              update('experienceLevel')(event.target.value)
            }}
            className={CONTROL_CLASS}
          >
            <option value="">¿Cuánta experiencia tienes?</option>
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {EXPERIENCE_LABEL[level]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Modalidad" column="hiring_modality_id">
          <select
            value={draft.hiringModalityId}
            onChange={(event) => {
              update('hiringModalityId')(event.target.value)
            }}
            className={CONTROL_CLASS}
          >
            <option value="">Elige la modalidad…</option>
            {(options?.modalities ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Transporte" column="transport_type">
          <select
            value={draft.transportType}
            onChange={(event) => {
              update('transportType')(event.target.value)
            }}
            className={CONTROL_CLASS}
          >
            <option value="">¿Cómo te trasladas?</option>
            {TRANSPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {TRANSPORT_LABEL[type]}
              </option>
            ))}
          </select>
        </Field>

        <p className="text-xs text-ink-4">
          Los 5 integran is_profile_complete (9 en total en vw_worker)
        </p>
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-4">
        <h2 className="text-sm font-semibold text-ink">Foto e identificación fiscal</h2>

        <PhotoUpload
          initials={profile?.fullName.charAt(0) ?? ''}
          currentUrl={profile?.photoUrl ?? null}
          onUploaded={(path) => {
            update('photoPath')(path)
          }}
        />

        {/* El cifrado de campo no está conectado (D-27): se dice, no se finge. */}
        <div className="flex items-center justify-between rounded-md bg-surface-2 px-4 py-3">
          <span className="text-sm text-ink-2">Subir SSN / ITIN</span>
          <span className="rounded-full border border-dashed border-ink-4 px-2.5 py-0.5 text-xs text-ink-3">
            pendiente
          </span>
        </div>
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
          Perfil laboral guardado. Sigue la Fase 3.
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
