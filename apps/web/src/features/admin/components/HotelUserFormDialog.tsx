import { zodResolver } from '@hookform/resolvers/zod'
import {
  cn,
  Input,
  MaterialIcon,
  toast,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@oranje/ui'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import {
  useCreateHotelUserMutation,
  useGetHotelUsersQuery,
  useResendHotelInvitationMutation,
  useUpdateHotelUserMutation,
} from '../api/adminApi'
import {
  HOTEL_GENERAL_MANAGER,
  HOTEL_ROLE_OPTIONS,
  HOTEL_SUPERIOR_ROLES,
  type DepartmentOption,
  type HotelOption,
  type HotelUser,
} from '../types/admin.types'

import { FormRow } from './UserFormDialog'
import { initialsOf } from './userListParts'

import personajeManager from '@/assets/ilustrations/personaje-manager.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const FORM_ID = 'hotel-user-form'
const NOBODY = 'NONE'
/**
 * El departamento es OPCIONAL para Supervisor y Manager de Área — sin uno,
 * la cuenta cubre TODO el hotel (jerarquía simple, Hotel.md: "Manager
 * General → SUP → Colaboradores", sin split por departamento). Radix no
 * acepta un `SelectItem` con `value=""`, así que "ninguno" es un valor
 * explícito, igual que `NOBODY` en «Reporta a».
 */
const NO_DEPARTMENT = 'ALL'

const hotelUserFormSchema = z.object({
  hotelId: z.string().min(1, 'Elige el hotel'),
  roleCode: z.string().min(1, 'Elige el rol'),
  departmentId: z.string(),
  fullName: z
    .string()
    .trim()
    .min(1, 'Escribe el nombre completo')
    .max(160, 'Máximo 160 caracteres'),
  email: z
    .string()
    .trim()
    .email('Escribe un correo válido, como ana@hotel.com')
    .max(255, 'Máximo 255 caracteres'),
  reportsToUserId: z.string(),
})

type HotelUserFormValues = z.infer<typeof hotelUserFormSchema>

const ERROR_BY_CODE = {
  EMAIL_TAKEN: 'Ese correo ya está dado de alta en Oranje.',
  DEPARTMENT_NOT_ALLOWED: 'El Manager General no lleva departamento: cubre todo el hotel.',
  SUPERVISOR_NOT_IN_HOTEL: 'La persona a la que reporta no es de ese hotel o está de baja.',
  HOTEL_NOT_FOUND: 'Ese hotel ya no existe. Recarga la página y vuelve a elegirlo.',
  USER_NOT_FOUND: 'Esa cuenta ya no existe en ese hotel. Recarga la página.',
  INVITATION_FAILED:
    'La cuenta quedó guardada, pero el correo de invitación no salió: reenvíala desde su ficha.',
} as const

function saveErrorMessage(error: unknown): string {
  return apiErrorMessage(error, {
    byCode: ERROR_BY_CODE,
    fallback: 'No se pudo guardar la cuenta. Revisa los datos e inténtalo de nuevo.',
  })
}

/**
 * Alta y edición de una cuenta del hotel por el Administrador (Reglas de
 * Negocio · Cuentas del hotel). El hotel, el rol y el correo se fijan al crear:
 * cambiar cualquiera de los tres es otra cuenta. La credencial nace por
 * invitación, como la del personal.
 */
export function HotelUserFormDialog({
  isOpen,
  onClose,
  user,
  hotels,
  departments,
}: {
  isOpen: boolean
  onClose: () => void
  user: HotelUser | null
  hotels: HotelOption[]
  departments: DepartmentOption[]
}): ReactNode {
  const isEditing = user !== null
  const [createUser, createState] = useCreateHotelUserMutation()
  const [updateUser, updateState] = useUpdateHotelUserMutation()
  const [resendInvitation, resendState] = useResendHotelInvitationMutation()
  const isBusy = createState.isLoading || updateState.isLoading
  const [isActive, setIsActive] = useState(true)
  const [created, setCreated] = useState<{ email: string; sent: boolean } | null>(null)
  const [confirmingBaja, setConfirmingBaja] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HotelUserFormValues>({
    resolver: zodResolver(hotelUserFormSchema),
    mode: 'onChange',
    defaultValues: {
      hotelId: '',
      roleCode: '',
      departmentId: NO_DEPARTMENT,
      fullName: '',
      email: '',
      reportsToUserId: NOBODY,
    },
  })

  const hotelId = watch('hotelId')
  const roleCode = watch('roleCode')
  const departmentId = watch('departmentId')
  const fullName = watch('fullName')
  const reportsToUserId = watch('reportsToUserId')
  const isGeneralManager = roleCode === HOTEL_GENERAL_MANAGER

  /* Los jefes posibles viven en el hotel elegido: se piden solo cuando hay hotel. */
  const { data: hotelPeople } = useGetHotelUsersQuery(
    { hotelId, includeInactive: false },
    { skip: !isOpen || hotelId === '' },
  )
  const allowedSuperiors = roleCode ? HOTEL_SUPERIOR_ROLES[roleCode] : undefined
  const superiorOptions = (hotelPeople?.rows ?? []).filter(
    (option) =>
      option.id !== user?.id &&
      option.isActive &&
      (allowedSuperiors === undefined || allowedSuperiors.includes(option.role.code)) &&
      /* Un Supervisor reporta a un Manager de Área DE SU DEPARTAMENTO, o al General.
         Sin departamento (cubre todo el hotel), cualquier Manager de Área vale. */
      (option.role.code !== 'ROL-H-02' ||
        departmentId === NO_DEPARTMENT ||
        option.department === null ||
        option.department.id === departmentId),
  )

  /** Un auto-pick por rol: con un solo candidato se propone; «Nadie» elegido a mano se respeta. */
  const autoPickedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!isOpen || !roleCode || hotelId === '') return
    const isValid =
      reportsToUserId === NOBODY || superiorOptions.some((option) => option.id === reportsToUserId)
    if (!isValid) {
      setValue('reportsToUserId', NOBODY)
      return
    }
    const key = `${hotelId}:${roleCode}:${departmentId}`
    if (
      reportsToUserId === NOBODY &&
      superiorOptions.length === 1 &&
      autoPickedFor.current !== key
    ) {
      autoPickedFor.current = key
      setValue('reportsToUserId', superiorOptions[0]?.id ?? NOBODY)
    }
    /* `superiorOptions` deriva de hotel, rol, depto y la lista: alcanza con estos. */
  }, [isOpen, hotelId, roleCode, departmentId, reportsToUserId, hotelPeople?.rows.length])

  /* El Manager General no lleva departamento: al elegirlo se limpia. */
  useEffect(() => {
    if (isGeneralManager && departmentId !== NO_DEPARTMENT) setValue('departmentId', NO_DEPARTMENT)
  }, [isGeneralManager, departmentId, setValue])

  useEffect(() => {
    if (!isOpen) return
    createState.reset()
    updateState.reset()
    resendState.reset()
    setIsActive(user?.isActive ?? true)
    setCreated(null)
    setConfirmingBaja(false)
    autoPickedFor.current = null
    reset({
      hotelId: user?.hotel.id ?? '',
      roleCode: user?.role.code ?? '',
      departmentId: user?.department?.id ?? NO_DEPARTMENT,
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      reportsToUserId: user?.reportsToUserId ?? NOBODY,
    })
  }, [isOpen, user, reset])

  async function onSubmit(values: HotelUserFormValues): Promise<void> {
    const reportsTo = values.reportsToUserId === NOBODY ? null : values.reportsToUserId
    const isGeneralManagerRole = values.roleCode === HOTEL_GENERAL_MANAGER
    const department = isGeneralManagerRole
      ? null
      : values.departmentId === NO_DEPARTMENT
        ? null
        : values.departmentId

    if (isEditing) {
      await updateUser({
        hotelId: user.hotel.id,
        id: user.id,
        body: {
          fullName: values.fullName,
          /* El Manager General no toca departamento; los demás sí pueden
             LIMPIARLO a `null` (vuelve a cubrir todo el hotel) — por eso se
             manda explícito y no se omite cuando es null. */
          ...(isGeneralManagerRole ? {} : { departmentId: department }),
          reportsToUserId: reportsTo,
          isActive,
        },
      }).unwrap()
      toast.success(user.isActive === false && isActive ? 'Cuenta activada' : 'Cuenta actualizada')
      onClose()
      return
    }

    const result = await createUser({
      hotelId: values.hotelId,
      body: {
        email: values.email,
        fullName: values.fullName,
        roleCode: values.roleCode,
        ...(department ? { departmentId: department } : {}),
        ...(reportsTo ? { reportsToUserId: reportsTo } : {}),
      },
    }).unwrap()
    const sent = result.invitationSent !== false
    toast.success(sent ? `Cuenta creada — invitación enviada a ${values.email}` : 'Cuenta creada')
    setCreated({ email: values.email, sent })
  }

  async function darDeBaja(): Promise<void> {
    if (!isEditing) return
    await updateUser({ hotelId: user.hotel.id, id: user.id, body: { isActive: false } }).unwrap()
    toast.success('Cuenta dada de baja')
    onClose()
  }

  const saveError = createState.error ?? updateState.error
  const initials = initialsOf(fullName)
  const hotelName = hotels.find((hotel) => hotel.id === hotelId)?.name
  const roleLabel = HOTEL_ROLE_OPTIONS.find((role) => role.code === roleCode)?.name

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar cuenta del hotel' : 'Nueva cuenta del hotel'}
      chromeless
      className="max-w-2xl"
    >
      <div className="flex max-h-[calc(100vh-3rem)] flex-col overflow-y-auto">
        <div className="relative h-32 shrink-0 bg-gradient-to-r from-o-50 via-o-50/70 to-surface-2">
          <img
            src={personajeManager}
            alt=""
            aria-hidden
            className="absolute right-10 bottom-2 h-28 w-auto"
          />
          <span
            aria-hidden
            className="absolute -bottom-11 left-8 z-10 flex size-22 items-center justify-center rounded-full border-4 border-surface bg-o-50 text-xl font-bold text-o-700 shadow-md"
          >
            {initials !== '' ? initials : <MaterialIcon name="apartment" className="text-2xl" />}
          </span>
        </div>

        <header className="px-8 pt-14 pb-5">
          <h2 className="text-xl font-bold text-ink">
            {fullName.trim() === '' ? 'Nueva cuenta del hotel' : fullName}
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">
            {[roleLabel, hotelName].filter(Boolean).join(' · ') ||
              (isEditing ? 'Editar cuenta del hotel' : 'Alta de una cuenta del hotel')}
            {IS_DEV_UI && (
              <code className="text-[11px] text-ink-4"> · identity.user · users:manage_hotel</code>
            )}
          </p>
        </header>

        {created ? (
          <div className="flex flex-col items-center gap-3 border-t border-line px-8 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-green/10">
              <MaterialIcon
                name={created.sent ? 'mark_email_read' : 'check_circle'}
                className="text-3xl text-green"
              />
            </span>
            <p className="text-lg font-bold text-ink">
              {created.sent ? 'Invitación enviada a:' : 'Cuenta creada'}
            </p>
            <p className="text-sm font-semibold text-o-700">{created.email}</p>
            <p className="max-w-sm text-xs leading-relaxed text-ink-3">
              {created.sent
                ? 'La persona recibirá un correo para establecer su contraseña. Hasta que entre por primera vez, su cuenta aparece como «Invitación enviada».'
                : 'La cuenta quedó guardada, pero el correo de invitación no salió. Reenvíala desde su ficha en unos minutos.'}
            </p>
            <Button variant="primary" className="mt-2" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        ) : (
          <form
            id={FORM_ID}
            noValidate
            onSubmit={(event) => {
              void handleSubmit(onSubmit)(event)
            }}
          >
            <FormRow label="Hotel" column="hotel_id · inmutable">
              <Controller
                control={control}
                name="hotelId"
                render={({ field }) => (
                  <Select
                    {...(field.value ? { value: field.value } : {})}
                    onValueChange={field.onChange}
                    disabled={isEditing}
                  >
                    <SelectTrigger aria-label="Hotel" className="w-full">
                      <SelectValue placeholder="Elige el hotel" />
                    </SelectTrigger>
                    <SelectContent>
                      {hotels.map((hotel) => (
                        <SelectItem key={hotel.id} value={hotel.id}>
                          {hotel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {!isEditing && hotels.length === 0 && (
                <p className="text-xs text-ink-3">
                  Todavía no hay hoteles dados de alta: los crea Ventas en el Pipeline.
                </p>
              )}
              {errors.hotelId && <p className="text-xs text-red">{errors.hotelId.message}</p>}
            </FormRow>

            <FormRow label="Rol" column="role_id · inmutable">
              <Controller
                control={control}
                name="roleCode"
                render={({ field }) => (
                  <Select
                    {...(field.value ? { value: field.value } : {})}
                    onValueChange={field.onChange}
                    disabled={isEditing}
                  >
                    <SelectTrigger aria-label="Rol" className="w-full">
                      <SelectValue placeholder="Elige el rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {HOTEL_ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role.code} value={role.code}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-ink-3">
                El primer Manager General de cada hotel nace en la Conversión; aquí se dan de alta
                los Supervisores, los Managers de Área y los Managers Generales adicionales.
              </p>
              {errors.roleCode && <p className="text-xs text-red">{errors.roleCode.message}</p>}
            </FormRow>

            {roleCode !== '' && !isGeneralManager && (
              <FormRow label="Departamento" column="department_id">
                <Controller
                  control={control}
                  name="departmentId"
                  render={({ field }) => (
                    <Select
                      {...(field.value ? { value: field.value } : {})}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger aria-label="Departamento" className="w-full">
                        <SelectValue placeholder="Elige el departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DEPARTMENT}>Ninguno — cubre todo el hotel</SelectItem>
                        {departments.map((department) => (
                          <SelectItem key={department.id} value={department.id}>
                            {department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-ink-3">
                  {departmentId === NO_DEPARTMENT
                    ? 'Sin departamento, esta cuenta ve y pide personal de TODOS los departamentos del hotel — la jerarquía simple de un hotel chico, con un solo Supervisor.'
                    : roleCode === 'ROL-H-01'
                      ? 'El Supervisor revisa el timesheet de su departamento; no verá ni podrá pedir personal de los demás.'
                      : 'El Manager de Área autoriza y aprueba lo de su departamento; no lo de los demás.'}
                </p>
              </FormRow>
            )}

            <FormRow label="Nombre completo" column="full_name">
              <Input
                aria-label="Nombre completo"
                {...register('fullName')}
                placeholder="Ana López García"
              />
              {errors.fullName && <p className="text-xs text-red">{errors.fullName.message}</p>}
            </FormRow>

            <FormRow label="Correo" column="email · inmutable">
              <Input
                aria-label="Correo"
                type="email"
                {...register('email')}
                placeholder="ana@hotel.com"
                disabled={isEditing}
                className={cn(isEditing && 'cursor-not-allowed bg-surface-2')}
              />
              {!isEditing && (
                <p className="text-xs text-ink-3">
                  Al crear la cuenta, la persona recibe un correo de invitación y establece su
                  contraseña.
                </p>
              )}
              {errors.email && <p className="text-xs text-red">{errors.email.message}</p>}
            </FormRow>

            <FormRow label="Reporta a" column="reports_to_user_id">
              <Controller
                control={control}
                name="reportsToUserId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={hotelId === '' || roleCode === '' || isGeneralManager}
                  >
                    <SelectTrigger aria-label="Reporta a" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NOBODY}>
                        {isGeneralManager
                          ? 'Nadie — la punta de la jerarquía del hotel'
                          : 'Nadie (sin jefe por ahora)'}
                      </SelectItem>
                      {superiorOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.fullName} · {option.role.name}
                          {option.department ? ` · ${option.department.name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-ink-3">
                {isGeneralManager
                  ? 'El Manager General no reporta a nadie.'
                  : hotelId === '' || roleCode === ''
                    ? 'Elige primero el hotel y el rol: los jefes posibles salen de ahí.'
                    : superiorOptions.length === 0
                      ? roleCode === 'ROL-H-01'
                        ? 'En ese hotel aún no hay un Manager de Área de ese departamento ni un Manager General activos.'
                        : 'En ese hotel aún no hay un Manager General activo.'
                      : roleCode === 'ROL-H-01'
                        ? 'El Supervisor reporta a un Manager de Área de su departamento o al Manager General.'
                        : 'El Manager de Área reporta al Manager General.'}
              </p>
              {!isGeneralManager &&
                roleCode !== '' &&
                reportsToUserId === NOBODY &&
                superiorOptions.length > 0 && (
                  <p className="text-xs font-medium text-o-700">
                    Este rol normalmente reporta a alguien: sin jefe no aparecerá en ningún «Mi
                    Equipo».
                  </p>
                )}
            </FormRow>

            {isEditing && !user.hasAccount && (
              <FormRow label="Invitación" column="hasAccount:false">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-ink-2">
                    {resendState.isSuccess
                      ? 'Invitación reenviada: la persona tiene un correo nuevo para establecer su contraseña.'
                      : 'Todavía no ha entrado por primera vez.'}
                  </span>
                  {!resendState.isSuccess && (
                    <Button
                      type="button"
                      disabled={resendState.isLoading}
                      onClick={() => {
                        void resendInvitation({ hotelId: user.hotel.id, id: user.id })
                          .unwrap()
                          .then(() => {
                            toast.success('Invitación enviada')
                          })
                          .catch((error: unknown) => {
                            toast.error(saveErrorMessage(error))
                          })
                      }}
                    >
                      {resendState.isLoading ? 'Enviando…' : 'Reenviar invitación'}
                    </Button>
                  )}
                </div>
              </FormRow>
            )}

            {isEditing && (
              <FormRow label="Estado" column="is_active">
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
              </FormRow>
            )}

            {saveError !== undefined && (
              <p role="alert" className="px-6 pb-2 text-sm text-red">
                {saveErrorMessage(saveError)}
              </p>
            )}

            <div className="flex items-center gap-3 border-t border-line px-6 py-4">
              {isEditing && user.isActive && (
                <Button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    if (!confirmingBaja) {
                      setConfirmingBaja(true)
                      return
                    }
                    void darDeBaja()
                  }}
                  className={cn(
                    'text-red',
                    confirmingBaja && 'border border-red/40 bg-red/5 font-semibold',
                  )}
                >
                  {confirmingBaja ? 'Sí, dar de baja' : 'Dar de baja'}
                </Button>
              )}
              <span className="flex-1" />
              <Button type="button" onClick={onClose} disabled={isBusy}>
                Cancelar
              </Button>
              <Button type="submit" form={FORM_ID} variant="primary" disabled={isBusy}>
                {isBusy ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear cuenta'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
