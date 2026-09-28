import { zodResolver } from '@hookform/resolvers/zod'
import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
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
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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

/* Los mensajes se resuelven al armar el esquema con el `i18n` del componente
   (D-36): quien lo usa lo rearma cuando cambia el idioma. */
function buildHotelUserFormSchema(i18n: I18n) {
  return z.object({
    hotelId: z.string().min(1, i18n._(msg`Elige el hotel`)),
    roleCode: z.string().min(1, i18n._(msg`Elige el rol`)),
    departmentId: z.string(),
    locale: z.enum(['es', 'en']),
    fullName: z
      .string()
      .trim()
      .min(1, i18n._(msg`Escribe el nombre completo`))
      .max(160, i18n._(msg`Máximo 160 caracteres`)),
    email: z
      .string()
      .trim()
      .email(i18n._(msg`Escribe un correo válido, como ana@hotel.com`))
      .max(255, i18n._(msg`Máximo 255 caracteres`)),
    reportsToUserId: z.string(),
  })
}

type HotelUserFormValues = z.infer<ReturnType<typeof buildHotelUserFormSchema>>

/** El `i18n` viene del componente (`useLingui`): así el mensaje habla el idioma activo (D-36). */
function saveErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      EMAIL_TAKEN: i18n._(msg`Ese correo ya está dado de alta en Oranje.`),
      DEPARTMENT_NOT_ALLOWED: i18n._(
        msg`El Manager General no lleva departamento: cubre todo el hotel.`,
      ),
      SUPERVISOR_NOT_IN_HOTEL: i18n._(
        msg`La persona a la que reporta no es de ese hotel o está de baja.`,
      ),
      HOTEL_NOT_FOUND: i18n._(msg`Ese hotel ya no existe. Recarga la página y vuelve a elegirlo.`),
      USER_NOT_FOUND: i18n._(msg`Esa cuenta ya no existe en ese hotel. Recarga la página.`),
      INVITATION_FAILED: i18n._(
        msg`La cuenta quedó guardada, pero el correo de invitación no salió: reenvíala desde su ficha.`,
      ),
    },
    fallback: i18n._(msg`No se pudo guardar la cuenta. Revisa los datos e inténtalo de nuevo.`),
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
  const { t, i18n } = useLingui()
  const isEditing = user !== null
  const [createUser, createState] = useCreateHotelUserMutation()
  const [updateUser, updateState] = useUpdateHotelUserMutation()
  const [resendInvitation, resendState] = useResendHotelInvitationMutation()
  const isBusy = createState.isLoading || updateState.isLoading
  const [isActive, setIsActive] = useState(true)
  const [created, setCreated] = useState<{ email: string; sent: boolean } | null>(null)
  const [confirmingBaja, setConfirmingBaja] = useState(false)

  /* Los mensajes del esquema se resuelven al armarlo, así que se rearma al
     cambiar de idioma: `i18n` no cambia de identidad al activar otro (D-36). */
  const schema = useMemo(() => buildHotelUserFormSchema(i18n), [i18n, i18n.locale])

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HotelUserFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      hotelId: '',
      roleCode: '',
      departmentId: NO_DEPARTMENT,
      locale: 'es',
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
      /* Campo del alta: al reabrir vuelve a español, y quien ya tiene cuenta
         cambia su idioma desde la suya. */
      locale: 'es',
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
      toast.success(
        user.isActive === false && isActive ? t`Cuenta activada` : t`Cuenta actualizada`,
      )
      onClose()
      return
    }

    const result = await createUser({
      hotelId: values.hotelId,
      body: {
        email: values.email,
        fullName: values.fullName,
        roleCode: values.roleCode,
        locale: values.locale,
        ...(department ? { departmentId: department } : {}),
        ...(reportsTo ? { reportsToUserId: reportsTo } : {}),
      },
    }).unwrap()
    const sent = result.invitationSent !== false
    toast.success(sent ? t`Cuenta creada — invitación enviada a ${values.email}` : t`Cuenta creada`)
    setCreated({ email: values.email, sent })
  }

  async function darDeBaja(): Promise<void> {
    if (!isEditing) return
    await updateUser({ hotelId: user.hotel.id, id: user.id, body: { isActive: false } }).unwrap()
    toast.success(t`Cuenta dada de baja`)
    onClose()
  }

  const saveError = createState.error ?? updateState.error
  const initials = initialsOf(fullName)
  const hotelName = hotels.find((hotel) => hotel.id === hotelId)?.name
  const roleEntry = HOTEL_ROLE_OPTIONS.find((role) => role.code === roleCode)
  const roleLabel = roleEntry ? i18n._(roleEntry.name) : undefined

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t`Editar cuenta del hotel` : t`Nueva cuenta del hotel`}
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
            {fullName.trim() === '' ? t`Nueva cuenta del hotel` : fullName}
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">
            {[roleLabel, hotelName].filter(Boolean).join(' · ') ||
              (isEditing ? t`Editar cuenta del hotel` : t`Alta de una cuenta del hotel`)}
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
              {created.sent ? t`Invitación enviada a:` : t`Cuenta creada`}
            </p>
            <p className="text-sm font-semibold text-o-700">{created.email}</p>
            <p className="max-w-sm text-xs leading-relaxed text-ink-3">
              {created.sent
                ? t`La persona recibirá un correo para establecer su contraseña. Hasta que entre por primera vez, su cuenta aparece como «Invitación enviada».`
                : t`La cuenta quedó guardada, pero el correo de invitación no salió. Reenvíala desde su ficha en unos minutos.`}
            </p>
            <Button variant="primary" className="mt-2" onClick={onClose}>
              <Trans>Cerrar</Trans>
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
            <FormRow label={t`Hotel`} column="hotel_id · inmutable">
              <Controller
                control={control}
                name="hotelId"
                render={({ field }) => (
                  <Select
                    {...(field.value ? { value: field.value } : {})}
                    onValueChange={field.onChange}
                    disabled={isEditing}
                  >
                    <SelectTrigger aria-label={t`Hotel`} className="w-full">
                      <SelectValue placeholder={t`Elige el hotel`} />
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
                  <Trans>
                    Todavía no hay hoteles dados de alta: los crea Ventas en el Pipeline.
                  </Trans>
                </p>
              )}
              {errors.hotelId && <p className="text-xs text-red">{errors.hotelId.message}</p>}
            </FormRow>

            <FormRow label={t`Rol`} column="role_id · inmutable">
              <Controller
                control={control}
                name="roleCode"
                render={({ field }) => (
                  <Select
                    {...(field.value ? { value: field.value } : {})}
                    onValueChange={field.onChange}
                    disabled={isEditing}
                  >
                    <SelectTrigger aria-label={t`Rol`} className="w-full">
                      <SelectValue placeholder={t`Elige el rol`} />
                    </SelectTrigger>
                    <SelectContent>
                      {HOTEL_ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role.code} value={role.code}>
                          {i18n._(role.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-ink-3">
                <Trans>
                  El primer Manager General de cada hotel nace en la Conversión; aquí se dan de alta
                  los Supervisores, los Managers de Área y los Managers Generales adicionales.
                </Trans>
              </p>
              {errors.roleCode && <p className="text-xs text-red">{errors.roleCode.message}</p>}
            </FormRow>

            {roleCode !== '' && !isGeneralManager && (
              <FormRow label={t`Departamento`} column="department_id">
                <Controller
                  control={control}
                  name="departmentId"
                  render={({ field }) => (
                    <Select
                      {...(field.value ? { value: field.value } : {})}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger aria-label={t`Departamento`} className="w-full">
                        <SelectValue placeholder={t`Elige el departamento`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DEPARTMENT}>
                          <Trans>Ninguno — cubre todo el hotel</Trans>
                        </SelectItem>
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
                    ? t`Sin departamento, esta cuenta ve y pide personal de TODOS los departamentos del hotel — la jerarquía simple de un hotel chico, con un solo Supervisor.`
                    : roleCode === 'ROL-H-01'
                      ? t`El Supervisor revisa el timesheet de su departamento; no verá ni podrá pedir personal de los demás.`
                      : t`El Manager de Área autoriza y aprueba lo de su departamento; no lo de los demás.`}
                </p>
              </FormRow>
            )}

            <FormRow label={t`Nombre completo`} column="full_name">
              <Input
                aria-label={t`Nombre completo`}
                {...register('fullName')}
                placeholder="Ana López García"
              />
              {errors.fullName && <p className="text-xs text-red">{errors.fullName.message}</p>}
            </FormRow>

            <FormRow label={t`Correo`} column="email · inmutable">
              <Input
                aria-label={t`Correo`}
                type="email"
                {...register('email')}
                placeholder="ana@hotel.com"
                disabled={isEditing}
                className={cn(isEditing && 'cursor-not-allowed bg-surface-2')}
              />
              {!isEditing && (
                <p className="text-xs text-ink-3">
                  <Trans>
                    Al crear la cuenta, la persona recibe un correo de invitación y establece su
                    contraseña.
                  </Trans>
                </p>
              )}
              {errors.email && <p className="text-xs text-red">{errors.email.message}</p>}
            </FormRow>

            {!isEditing && (
              <FormRow label={t`Idioma`} column="locale">
                <Controller
                  control={control}
                  name="locale"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label={t`Idioma`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Cada uno en su propio idioma, como el interruptor del login. */}
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-ink-3">
                  <Trans>
                    En este idioma le llega la invitación y abre la app la primera vez. Después lo
                    cambia desde su cuenta.
                  </Trans>
                </p>
              </FormRow>
            )}

            <FormRow label={t`Reporta a`} column="reports_to_user_id">
              <Controller
                control={control}
                name="reportsToUserId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={hotelId === '' || roleCode === '' || isGeneralManager}
                  >
                    <SelectTrigger aria-label={t`Reporta a`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NOBODY}>
                        {isGeneralManager
                          ? t`Nadie — la punta de la jerarquía del hotel`
                          : t`Nadie (sin jefe por ahora)`}
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
                  ? t`El Manager General no reporta a nadie.`
                  : hotelId === '' || roleCode === ''
                    ? t`Elige primero el hotel y el rol: los jefes posibles salen de ahí.`
                    : superiorOptions.length === 0
                      ? roleCode === 'ROL-H-01'
                        ? t`En ese hotel aún no hay un Manager de Área de ese departamento ni un Manager General activos.`
                        : t`En ese hotel aún no hay un Manager General activo.`
                      : roleCode === 'ROL-H-01'
                        ? t`El Supervisor reporta a un Manager de Área de su departamento o al Manager General.`
                        : t`El Manager de Área reporta al Manager General.`}
              </p>
              {!isGeneralManager &&
                roleCode !== '' &&
                reportsToUserId === NOBODY &&
                superiorOptions.length > 0 && (
                  <p className="text-xs font-medium text-o-700">
                    <Trans>
                      Este rol normalmente reporta a alguien: sin jefe no aparecerá en ningún «Mi
                      Equipo».
                    </Trans>
                  </p>
                )}
            </FormRow>

            {isEditing && !user.hasAccount && (
              <FormRow label={t`Invitación`} column="hasAccount:false">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-ink-2">
                    {resendState.isSuccess
                      ? t`Invitación reenviada: la persona tiene un correo nuevo para establecer su contraseña.`
                      : t`Todavía no ha entrado por primera vez.`}
                  </span>
                  {!resendState.isSuccess && (
                    <Button
                      type="button"
                      disabled={resendState.isLoading}
                      onClick={() => {
                        void resendInvitation({ hotelId: user.hotel.id, id: user.id })
                          .unwrap()
                          .then(() => {
                            toast.success(t`Invitación enviada`)
                          })
                          .catch((error: unknown) => {
                            toast.error(saveErrorMessage(error, i18n))
                          })
                      }}
                    >
                      {resendState.isLoading ? t`Enviando…` : t`Reenviar invitación`}
                    </Button>
                  )}
                </div>
              </FormRow>
            )}

            {isEditing && (
              <FormRow label={t`Estado`} column="is_active">
                <label className="flex w-fit cursor-pointer items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    aria-label={t`Activo`}
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
                    {isActive
                      ? t`Activo — puede entrar al sistema`
                      : t`De baja — ya no puede entrar`}
                  </span>
                </label>
                <p className="text-xs text-ink-3">
                  <Trans>
                    Dar de baja no borra nada: la persona deja de entrar y su historial queda.
                  </Trans>
                </p>
              </FormRow>
            )}

            {saveError !== undefined && (
              <p role="alert" className="px-6 pb-2 text-sm text-red">
                {saveErrorMessage(saveError, i18n)}
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
                  {confirmingBaja ? t`Sí, dar de baja` : t`Dar de baja`}
                </Button>
              )}
              <span className="flex-1" />
              <Button type="button" onClick={onClose} disabled={isBusy}>
                <Trans>Cancelar</Trans>
              </Button>
              <Button type="submit" form={FORM_ID} variant="primary" disabled={isBusy}>
                {isBusy ? t`Guardando…` : isEditing ? t`Guardar cambios` : t`Crear cuenta`}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
