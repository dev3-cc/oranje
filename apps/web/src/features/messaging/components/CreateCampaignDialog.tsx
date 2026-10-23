import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import {
  Input,
  MaterialIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@oranje/ui'
import { useId, useState, type FormEvent, type ReactNode } from 'react'

import { useGetMessagingTagsQuery, type MessagingTag } from '../api/messagingApi'
import {
  useCreateMessagingCampaignMutation,
  type ContactField,
  type VariableMapping,
} from '../api/messagingCampaignCreateApi'
import { useGetMessagingTemplatesQuery, type MessagingTemplate } from '../api/messagingTemplatesApi'

import { SYNC_WORKERS_PERMISSION } from './SyncWorkersButton'

import { Button } from '@/shared/components/Button'
import { FormField } from '@/shared/components/FormField'
import { Modal } from '@/shared/components/Modal'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'

/* Las etiquetas que pone «Sincronizar colaboradores» (workers-messaging-sync
   del API): con ellas se eligen los destinatarios. */
const ORANJE_TAG = 'Oranje'
const HOTEL_PREFIX = 'Hotel: '
const STATE_PREFIX = 'Estado: '
const ALL = 'ALL'

/** Qué va en cada `{{n}}`: un dato de quien lo recibe o un texto fijo. */
type VariableSource = ContactField | 'static'

const SOURCE_LABEL: Record<VariableSource, MessageDescriptor> = {
  firstName: msg`Nombre del colaborador`,
  lastName: msg`Apellido del colaborador`,
  phoneE164: msg`Teléfono del colaborador`,
  static: msg`Texto fijo`,
}

const PREVIEW_LABEL: Record<ContactField, MessageDescriptor> = {
  firstName: msg`[Nombre]`,
  lastName: msg`[Apellido]`,
  phoneE164: msg`[Teléfono]`,
}

interface Variable {
  source: VariableSource
  value: string
}

/**
 * «+ Nueva campaña» (fase 2, Hugo, 2026-10-23). Bloqueado mientras haya
 * colaboradores nuevos sin sincronizar: si no, la campaña no les llegaría.
 * Lo ve quien puede sincronizar: crear pide el mismo permiso en el API.
 */
export function NewCampaignButton({ pendingWorkers }: { pendingWorkers: number }): ReactNode {
  const { i18n } = useLingui()
  const can = useCan()
  const [open, setOpen] = useState(false)

  if (!can(SYNC_WORKERS_PERMISSION)) return null

  const blocked = pendingWorkers > 0
  return (
    <>
      <Button
        variant="primary"
        className="h-10"
        disabled={blocked}
        title={blocked ? i18n._(msg`Primero sincroniza a los colaboradores nuevos.`) : undefined}
        onClick={() => {
          setOpen(true)
        }}
      >
        <MaterialIcon name="add" className="text-lg" />
        <Trans>Nueva campaña</Trans>
      </Button>
      {open && (
        <CreateCampaignDialog
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

/**
 * Crear una campaña en Borrador: nombre, plantilla aprobada, qué va en cada
 * variable y a quién (las etiquetas de hotel y estado). Enviarla es otra
 * acción, desde el listado y con su confirmación: aquí no sale ningún mensaje.
 */
export function CreateCampaignDialog({ onClose }: { onClose: () => void }): ReactNode {
  const { i18n } = useLingui()
  const ids = useId()
  const { data: templatesData } = useGetMessagingTemplatesQuery()
  const { data: tagsData } = useGetMessagingTagsQuery()
  const [create, { isLoading: isSaving }] = useCreateMessagingCampaignMutation()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [variables, setVariables] = useState<Variable[]>([])
  const [hotelTagId, setHotelTagId] = useState(ALL)
  const [stateTagId, setStateTagId] = useState(ALL)
  const [error, setError] = useState<string | null>(null)

  // Solo las aprobadas: Meta rechaza enviar cualquier otra.
  const templates =
    templatesData?.configured === true
      ? templatesData.templates.filter((template) => template.status === 'APPROVED')
      : []
  const template = templates.find((candidate) => candidate.id === templateId)
  const tags = tagsData?.configured === true ? tagsData.tags : []
  const oranjeTag = tags.find((tag) => tag.name === ORANJE_TAG)
  const hotelTags = tags.filter((tag) => tag.name.startsWith(HOTEL_PREFIX))
  const stateTags = tags.filter((tag) => tag.name.startsWith(STATE_PREFIX))

  const chooseTemplate = (id: string): void => {
    setTemplateId(id)
    const count = templates.find((candidate) => candidate.id === id)?.variableCount ?? 0
    // Por omisión {{1}} es el nombre: es como empiezan casi todas.
    setVariables(
      Array.from({ length: count }, (_, index) => ({
        source: index === 0 ? 'firstName' : 'static',
        value: '',
      })),
    )
  }

  const updateVariable = (index: number, change: Partial<Variable>): void => {
    setVariables((current) =>
      current.map((variable, at) => (at === index ? { ...variable, ...change } : variable)),
    )
  }

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setError(null)
    if (oranjeTag === undefined || template === undefined) return
    if (
      variables.some((variable) => variable.source === 'static' && variable.value.trim() === '')
    ) {
      setError(i18n._(msg`Escribe el texto de cada variable fija.`))
      return
    }

    const tagIds = [oranjeTag.id]
    if (hotelTagId !== ALL) tagIds.push(hotelTagId)
    if (stateTagId !== ALL) tagIds.push(stateTagId)
    const variableMapping: VariableMapping[] = variables.map((variable) =>
      variable.source === 'static'
        ? { kind: 'static', value: variable.value.trim() }
        : { kind: 'contact', field: variable.source },
    )

    try {
      const campaign = await create({
        name: name.trim(),
        ...(description.trim() === '' ? {} : { description: description.trim() }),
        templateId: template.id,
        variableMapping,
        tagIds,
      }).unwrap()
      if (campaign.totalRecipients === 0) {
        toast.warning(
          i18n._(
            msg`Se creó «${campaign.name}», pero nadie tiene esas etiquetas: revisa a quién va antes de enviarla.`,
          ),
        )
      } else {
        toast.success(
          i18n._(
            msg`Borrador «${campaign.name}» creado: le llegaría a ${campaign.totalRecipients} colaboradores.`,
          ),
        )
      }
      onClose()
    } catch (caught) {
      setError(apiErrorMessage(caught, { fallback: i18n._(msg`No se pudo crear la campaña.`) }))
    }
  }

  const formId = `${ids}-form`

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={i18n._(msg`Nueva campaña`)}
      description={i18n._(msg`Se guarda como borrador: enviarla es otro paso, desde el listado.`)}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            <Trans>Cancelar</Trans>
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            disabled={isSaving || oranjeTag === undefined || template === undefined}
          >
            <Trans>Crear borrador</Trans>
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
        <Step number={1} title={i18n._(msg`Datos`)}>
          <FormField label={i18n._(msg`Nombre *`)} htmlFor={`${ids}-name`}>
            <Input
              id={`${ids}-name`}
              required
              maxLength={120}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
              }}
            />
          </FormField>
          <FormField label={i18n._(msg`Descripción`)} htmlFor={`${ids}-description`}>
            <Input
              id={`${ids}-description`}
              maxLength={500}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value)
              }}
            />
          </FormField>
        </Step>

        <Step number={2} title={i18n._(msg`Plantilla`)}>
          {templates.length === 0 ? (
            <p className="text-sm text-ink-3">
              <Trans>
                No hay plantillas aprobadas. Sincronízalas desde Meta en la sección Plantillas.
              </Trans>
            </p>
          ) : (
            <Select value={templateId} onValueChange={chooseTemplate}>
              <SelectTrigger aria-label={i18n._(msg`Plantilla`)} className="w-full">
                <SelectValue placeholder={i18n._(msg`Elige una plantilla aprobada`)} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.name} · {candidate.language}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Step>

        {template !== undefined && (
          <Step number={3} title={i18n._(msg`Variables`)}>
            {variables.length === 0 ? (
              <p className="text-sm text-ink-3">
                <Trans>Esta plantilla no tiene variables: le llega igual a todos.</Trans>
              </p>
            ) : (
              variables.map((variable, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[4rem_1fr_1fr] sm:items-center">
                  <span className="font-mono text-sm text-ink-2">{`{{${String(index + 1)}}}`}</span>
                  <Select
                    value={variable.source}
                    onValueChange={(source) => {
                      updateVariable(index, { source: source as VariableSource })
                    }}
                  >
                    <SelectTrigger
                      aria-label={i18n._(msg`Qué va en la variable ${index + 1}`)}
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SOURCE_LABEL) as VariableSource[]).map((source) => (
                        <SelectItem key={source} value={source}>
                          {i18n._(SOURCE_LABEL[source])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {variable.source === 'static' ? (
                    <Input
                      aria-label={i18n._(msg`Texto de la variable ${index + 1}`)}
                      maxLength={200}
                      value={variable.value}
                      onChange={(event) => {
                        updateVariable(index, { value: event.target.value })
                      }}
                    />
                  ) : (
                    <span className="text-xs text-ink-3">
                      <Trans>Cada quien recibe el suyo.</Trans>
                    </span>
                  )}
                </div>
              ))
            )}
            <Preview template={template} variables={variables} />
          </Step>
        )}

        <Step number={4} title={i18n._(msg`Destinatarios`)}>
          {oranjeTag === undefined ? (
            <p className="text-sm text-st-rojo">
              <Trans>
                Todavía no hay colaboradores en la plataforma: usa «Sincronizar colaboradores».
              </Trans>
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <TagSelect
                  label={i18n._(msg`Hotel`)}
                  allLabel={i18n._(msg`Todos los hoteles`)}
                  prefix={HOTEL_PREFIX}
                  tags={hotelTags}
                  value={hotelTagId}
                  onChange={setHotelTagId}
                />
                <TagSelect
                  label={i18n._(msg`Estado`)}
                  allLabel={i18n._(msg`Todos los estados`)}
                  prefix={STATE_PREFIX}
                  tags={stateTags}
                  value={stateTagId}
                  onChange={setStateTagId}
                />
              </div>
              <p className="text-xs text-ink-3">
                <Trans>
                  Solo colaboradores de Oranje. La plataforma deja fuera a quien se dio de baja o
                  está en la lista negra.
                </Trans>
              </p>
            </>
          )}
        </Step>

        {error !== null && (
          <p role="alert" className="text-sm text-st-rojo">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}): ReactNode {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="flex size-6 items-center justify-center rounded-full bg-o-50 text-xs text-o-700">
          {number}
        </span>
        {title}
      </legend>
      {children}
    </fieldset>
  )
}

function TagSelect({
  label,
  allLabel,
  prefix,
  tags,
  value,
  onChange,
}: {
  label: string
  allLabel: string
  prefix: string
  tags: MessagingTag[]
  value: string
  onChange: (value: string) => void
}): ReactNode {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {tags.map((tag) => (
          <SelectItem key={tag.id} value={tag.id}>
            {tag.name.slice(prefix.length)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** El mensaje como se leería, con un marcador donde va el dato de cada quien. */
function Preview({
  template,
  variables,
}: {
  template: MessagingTemplate
  variables: Variable[]
}): ReactNode {
  const { i18n } = useLingui()
  if (template.body === null) return null

  const text = template.body.replace(/\{\{(\d+)\}\}/g, (match, position: string) => {
    const variable = variables[Number(position) - 1]
    if (variable === undefined) return match
    if (variable.source !== 'static') return i18n._(PREVIEW_LABEL[variable.source])
    return variable.value.trim() === '' ? match : variable.value.trim()
  })

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">
        <Trans>Así se leería</Trans>
      </span>
      <p className="whitespace-pre-line rounded-md bg-surface-2 p-3 text-sm text-ink-2">{text}</p>
    </div>
  )
}
