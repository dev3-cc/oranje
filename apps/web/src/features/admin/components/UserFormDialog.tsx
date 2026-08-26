import { zodResolver } from '@hookform/resolvers/zod'
import {
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import {
  useCreateStaffUserMutation,
  useResendInvitationMutation,
  useUpdateStaffUserMutation,
} from '../api/adminApi'
import type { AccessMode, RoleOption, StaffUser } from '../types/admin.types'

import { Button } from '@/shared/components/Button'
import { FormField } from '@/shared/components/FormField'
import { Modal } from '@/shared/components/Modal'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const FORM_ID = 'staff-user-form'
const NOBODY = 'NONE'

const userFormSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Falta el nombre').max(160),
    email: z.string().trim().email('No parece un correo válido').max(255),
    roleCode: z.string().min(1, 'Falta el rol'),
    reportsToUserId: z.string(),
    accessMode: z.enum(['INVITATION', 'PASSWORD']),
    password: z.string(),
  })
  .superRefine((values, context) => {
    if (values.accessMode === 'PASSWORD' && values.password.length < 8) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Mínimo 8 caracteres',
      })
    }
  })

type UserFormValues = z.infer<typeof userFormSchema>

function apiErrorMessage(error: unknown): string {
  const code = (error as { data?: { error?: { code?: string } } } | undefined)?.data?.error?.code
  switch (code) {
    case 'EMAIL_TAKEN':
      return 'Ese correo ya está dado de alta en Oranje.'
    case 'FIREBASE_EMAIL_EXISTS':
      return 'Ese correo ya tiene cuenta de acceso. Da el alta sin contraseña (invitación) o que la persona use «¿Olvidaste tu contraseña?».'
    case 'USE_HOTEL_USERS':
      return 'Ese rol no se da de alta aquí: los usuarios del Hotel nacen en la Conversión.'
    case 'ROLE_NOT_FOUND':
      return 'Ese rol no existe en el catálogo.'
    case 'SUPERVISOR_NOT_FOUND':
      return 'La persona a la que reporta no existe o está de baja.'
    case 'FIREBASE_UNAVAILABLE':
      return 'El usuario quedó guardado, pero su cuenta de acceso no se pudo crear. Reintenta la invitación más tarde.'
    default:
      return 'No se pudo guardar. Revisa los datos e intenta de nuevo.'
  }
}

export function UserFormDialog({
  isOpen,
  onClose,
  user,
  roles,
  reportsToOptions,
}: {
  isOpen: boolean
  onClose: () => void
  user: StaffUser | null
  roles: RoleOption[]
  reportsToOptions: StaffUser[]
}): ReactNode {
  const isEditing = user !== null
  const [createUser, createState] = useCreateStaffUserMutation()
  const [updateUser, updateState] = useUpdateStaffUserMutation()
  const [resendInvitation, resendState] = useResendInvitationMutation()
  const isBusy = createState.isLoading || updateState.isLoading
  const [isActive, setIsActive] = useState(true)

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      roleCode: '',
      reportsToUserId: NOBODY,
      accessMode: 'INVITATION',
      password: '',
    },
  })

  const accessMode = watch('accessMode')

  useEffect(() => {
    if (!isOpen) return
    createState.reset()
    updateState.reset()
    resendState.reset()
    setIsActive(user?.isActive ?? true)
    reset({
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      roleCode: user?.role.code ?? '',
      reportsToUserId: user?.reportsToUserId ?? NOBODY,
      accessMode: 'INVITATION',
      password: '',
    })
  }, [isOpen, user, reset])

  async function onSubmit(values: UserFormValues): Promise<void> {
    const reportsToUserId = values.reportsToUserId === NOBODY ? undefined : values.reportsToUserId

    if (isEditing) {
      await updateUser({
        id: user.id,
        body: {
          fullName: values.fullName,
          roleCode: values.roleCode,
          reportsToUserId: reportsToUserId ?? null,
          isActive,
        },
      }).unwrap()
    } else {
      await createUser({
        email: values.email,
        fullName: values.fullName,
        roleCode: values.roleCode,
        ...(reportsToUserId ? { reportsToUserId } : {}),
        ...(values.accessMode === 'PASSWORD' ? { password: values.password } : {}),
      }).unwrap()
    }
    onClose()
  }

  const saveError = createState.error ?? updateState.error

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar usuario' : 'Nuevo usuario'}
      description={
        IS_DEV_UI
          ? isEditing
            ? 'PATCH /users/:id · el correo es inmutable'
            : 'POST /users · Firebase es la autoridad de identidad (D-05)'
          : isEditing
            ? 'El correo no se puede cambiar.'
            : 'La persona entra con su correo; la contraseña depende del acceso que elijas.'
      }
      className="max-w-lg"
      footer={
        <>
          <Button type="button" onClick={onClose} disabled={isBusy}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" disabled={isBusy}>
            {isBusy ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event)
        }}
      >
        <FormField label="Nombre completo" htmlFor="su-name" error={errors.fullName?.message}>
          <Input id="su-name" {...register('fullName')} placeholder="Nombre y apellidos" />
        </FormField>

        <FormField
          label="Correo"
          htmlFor="su-email"
          error={errors.email?.message}
          hint={
            isEditing
              ? 'Cambiar de persona es dar de baja este usuario y dar de alta al nuevo.'
              : 'Inmutable después del alta: es el vínculo con la cuenta de Firebase.'
          }
        >
          <Input
            id="su-email"
            type="email"
            {...register('email')}
            placeholder="persona@casacurtidor.com"
            disabled={isEditing}
            className={cn(isEditing && 'cursor-not-allowed bg-surface-2')}
          />
        </FormField>

        <FormField
          label="Rol"
          htmlFor="su-role"
          error={errors.roleCode?.message}
          hint="Solo roles internos de Oranje — los de Hotel nacen en la Conversión."
        >
          <Controller
            control={control}
            name="roleCode"
            render={({ field }) => (
              <Select
                {...(field.value ? { value: field.value } : {})}
                onValueChange={field.onChange}
              >
                <SelectTrigger id="su-role" aria-label="Rol" className="w-full">
                  <SelectValue placeholder="Elige el rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.code} value={role.code}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField
          label="Reporta a"
          htmlFor="su-reports"
          hint="El BD apunta a su BDC; la Reclutadora a su Líder. Opcional."
        >
          <Controller
            control={control}
            name="reportsToUserId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="su-reports" aria-label="Reporta a" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOBODY}>Nadie (punta de la jerarquía)</SelectItem>
                  {reportsToOptions
                    .filter((option) => option.id !== user?.id)
                    .map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.fullName} · {option.role.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        {!isEditing && (
          <FormField label="Acceso">
            <Controller
              control={control}
              name="accessMode"
              render={({ field }) => (
                <div className="flex w-fit gap-1 rounded-xl bg-surface-2 p-1">
                  {(
                    [
                      ['INVITATION', 'Enviar invitación por correo'],
                      ['PASSWORD', 'Definir contraseña'],
                    ] as Array<[AccessMode, string]>
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        field.onChange(mode)
                      }}
                      className={cn(
                        'cursor-pointer rounded-lg px-3.5 py-2 text-xs transition-colors',
                        field.value === mode
                          ? 'border border-line bg-surface font-semibold text-ink'
                          : 'text-ink-3 hover:text-ink',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            />
          </FormField>
        )}

        {!isEditing && accessMode === 'INVITATION' && (
          <p className="rounded-xl bg-o-50 px-4 py-3 text-xs leading-relaxed text-o-700">
            Aquí no se captura contraseña: al crear, la persona recibe un correo de invitación y
            establece la suya. Hasta su primer login la cuenta aparece como «Invitación enviada».
          </p>
        )}

        {!isEditing && accessMode === 'PASSWORD' && (
          <FormField
            label="Contraseña"
            htmlFor="su-password"
            error={errors.password?.message}
            hint="Es su contraseña de uso: puede cambiarla cuando quiera con «¿Olvidaste tu contraseña?». No se envía por correo."
          >
            <Input id="su-password" type="password" {...register('password')} />
          </FormField>
        )}

        {isEditing && !user.hasAccount && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
            <span className="text-xs text-ink-2">
              {resendState.isSuccess
                ? 'Invitación reenviada: la persona tiene un correo nuevo para establecer su contraseña.'
                : 'Aún no hace su primer login: su invitación puede reenviarse.'}
            </span>
            {!resendState.isSuccess && (
              <Button
                type="button"
                disabled={resendState.isLoading}
                onClick={() => {
                  void resendInvitation(user.id)
                }}
              >
                {resendState.isLoading ? 'Enviando…' : 'Reenviar invitación'}
              </Button>
            )}
          </div>
        )}

        {isEditing && (
          <FormField label="Estado">
            <label className="flex w-fit cursor-pointer items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                aria-label="Activo"
                onClick={() => {
                  setIsActive((value) => !value)
                }}
                className={cn(
                  'relative h-5 w-9 cursor-pointer rounded-full transition-colors',
                  isActive ? 'bg-o-500' : 'bg-surface-3',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 size-4 rounded-full bg-white shadow transition-all',
                    isActive ? 'left-4' : 'left-0.5',
                  )}
                />
              </button>
              <span className="text-sm text-ink-2">
                {isActive ? 'Activo — puede entrar al sistema' : 'De baja — ya no puede entrar'}
              </span>
            </label>
            <p className="text-xs text-ink-3">
              Dar de baja no borra nada: la persona deja de entrar y su historial queda.
            </p>
          </FormField>
        )}

        {saveError !== undefined && (
          <p className="rounded-xl border border-red/40 bg-red/5 px-4 py-3 text-sm text-red">
            {apiErrorMessage(saveError)}
          </p>
        )}
      </form>
    </Modal>
  )
}
