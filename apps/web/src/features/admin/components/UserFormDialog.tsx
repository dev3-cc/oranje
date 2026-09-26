import { zodResolver } from '@hookform/resolvers/zod'
import type { I18n, MessageDescriptor } from '@lingui/core'
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
  useCreateStaffUserMutation,
  useGetUserZonesQuery,
  useGetZoneOptionsQuery,
  useResendInvitationMutation,
  useSetUserZonesMutation,
  useUpdateStaffUserMutation,
} from '../api/adminApi'
import type { AccessMode, RoleOption, StaffUser } from '../types/admin.types'

import { useUploadFileMutation } from '@/app/filesApi'
import personajeBienvenida from '@/assets/ilustrations/personaje-bienvenida.svg'
import personajeComencemos from '@/assets/ilustrations/personaje-comencemos.svg'
import personajePresentacion from '@/assets/ilustrations/personaje-presentacion.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { PasswordInput } from '@/shared/components/PasswordInput'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const FORM_ID = 'staff-user-form'
const NOBODY = 'NONE'
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeBienvenida,
    title: msg`Bienvenido al alta de personal`,
    text: msg`Aquí nace la cuenta de cada persona del equipo Oranje: quién es, qué rol tiene y a quién reporta.`,
  },
  {
    image: personajeComencemos,
    title: msg`Sin contraseñas de por medio`,
    text: msg`Manda la invitación por correo y cada quien establece la suya. Si lo necesitas, también puedes definirla tú.`,
  },
  {
    image: personajePresentacion,
    title: msg`Su rol define su app`,
    text: msg`El rol que elijas decide qué módulos verá la persona al entrar. Las cuentas de los hoteles se dan de alta en su propia pestaña.`,
  },
]

/**
 * Quién puede ser el jefe de cada rol, por la jerarquía de cada departamento:
 * el BD apunta a su BDC, la Reclutadora a su Líder, el Líder a su Manager…
 * y las cabezas de departamento al Administrador. Un rol sin fila muestra a
 * todos (resguardo: mejor de más que bloquear un alta).
 */
const SUPERIOR_ROLES: Partial<Record<string, readonly string[]>> = {
  'ROL-V-01': ['ROL-V-02'],
  'ROL-V-02': ['ROL-ADM-01'],
  'ROL-R-01': ['ROL-R-02'],
  'ROL-R-02': ['ROL-R-03'],
  'ROL-R-03': ['ROL-ADM-01'],
  'ROL-I-01': ['ROL-I-02'],
  'ROL-I-02': ['ROL-ADM-01'],
  'ROL-Q-01': ['ROL-Q-02'],
  'ROL-Q-02': ['ROL-ADM-01'],
  'ROL-CS-01': ['ROL-CS-02'],
  'ROL-CS-02': ['ROL-ADM-01'],
  'ROL-CO-01': ['ROL-CO-02'],
  'ROL-CO-02': ['ROL-ADM-01'],
  'ROL-ADM-01': [],
}

const PENDING_ROLES: ReadonlySet<string> = new Set([
  'ROL-Q-01',
  'ROL-Q-02',
  'ROL-CS-01',
  'ROL-CS-02',
])

/** Único rol con zonas propias fuera de Ventas: su alcance de requisiciones y auditorías. */
const INSPECTOR_ROLE_CODE = 'ROL-I-01'

/* Los mensajes se resuelven al armar el esquema con el `i18n` del componente
   (D-36): quien lo usa lo rearma cuando cambia el idioma. */
function buildUserFormSchema(i18n: I18n) {
  return z
    .object({
      fullName: z
        .string()
        .trim()
        .min(1, i18n._(msg`Escribe el nombre completo`))
        .max(160, i18n._(msg`Máximo 160 caracteres`)),
      email: z
        .string()
        .trim()
        .email(i18n._(msg`Escribe un correo válido, como ana@oranjepeople.com`))
        .max(255, i18n._(msg`Máximo 255 caracteres`)),
      roleCode: z.string().min(1, i18n._(msg`Elige un rol`)),
      reportsToUserId: z.string(),
      accessMode: z.enum(['INVITATION', 'PASSWORD']),
      locale: z.enum(['es', 'en']),
      password: z.string(),
    })
    .superRefine((values, context) => {
      if (values.accessMode === 'PASSWORD' && values.password.length < 8) {
        context.addIssue({
          code: 'custom',
          path: ['password'],
          message: i18n._(msg`La contraseña necesita al menos 8 caracteres`),
        })
      }
    })
}

type UserFormValues = z.infer<ReturnType<typeof buildUserFormSchema>>

/** El `i18n` viene del componente (`useLingui`): así el mensaje habla el idioma activo (D-36). */
function uploadErrorMessage(error: unknown, i18n: I18n): string {
  const status = (error as { status?: number } | undefined)?.status
  const code = (error as { data?: { error?: { code?: string } } } | undefined)?.data?.error?.code
  if (code === 'UNSUPPORTED_FILE_TYPE') {
    return i18n._(msg`Ese formato no se pudo abrir: usa una foto JPG, PNG o WebP.`)
  }
  if (status === 413) return i18n._(msg`La foto pesa demasiado: el máximo es 15 MB.`)
  return i18n._(msg`No se pudo subir la foto. Intenta con otra imagen.`)
}

function apiErrorMessage(error: unknown, i18n: I18n): string {
  const code = (error as { data?: { error?: { code?: string } } } | undefined)?.data?.error?.code
  switch (code) {
    case 'EMAIL_TAKEN':
      return i18n._(msg`Ese correo ya está dado de alta en Oranje.`)
    case 'FIREBASE_EMAIL_EXISTS':
      return i18n._(
        msg`Ese correo ya tiene cuenta de acceso. Da el alta sin contraseña (invitación) o que la persona use «¿Olvidaste tu contraseña?».`,
      )
    case 'USE_HOTEL_USERS':
      return i18n._(
        msg`Ese rol no se da de alta aquí: las cuentas de los hoteles van en «Personal de hoteles».`,
      )
    case 'ROLE_NOT_FOUND':
      return i18n._(msg`Ese rol ya no existe. Recarga la página y vuelve a elegirlo.`)
    case 'SUPERVISOR_NOT_FOUND':
      return i18n._(msg`La persona a la que reporta no existe o está de baja.`)
    case 'FIREBASE_UNAVAILABLE':
      /* Con contraseña la cuenta va ANTES de la fila: si Firebase no responde, NO se guardó nada. */
      return i18n._(
        msg`El servicio de acceso no respondió y el usuario no se creó. Inténtalo de nuevo en un momento.`,
      )
    case 'INVITATION_FAILED':
      return i18n._(
        msg`El usuario quedó guardado, pero el correo de invitación no salió: reenvíala desde su ficha.`,
      )
    default:
      return i18n._(msg`No se pudo guardar el usuario. Revisa los datos e inténtalo de nuevo.`)
  }
}

function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

export function FormRow({
  label,
  column,
  children,
}: {
  label: string
  column?: string
  children: ReactNode
}): ReactNode {
  return (
    <div className="grid grid-cols-1 gap-2 border-t border-line px-6 py-4 sm:grid-cols-[190px_1fr] sm:gap-6">
      <span className="pt-2.5 text-sm font-medium text-ink-2">
        {label}
        {IS_DEV_UI && column && <code className="block text-[11px] text-ink-4">{column}</code>}
      </span>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
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
  const { t, i18n } = useLingui()
  const isEditing = user !== null
  const [createUser, createState] = useCreateStaffUserMutation()
  const [updateUser, updateState] = useUpdateStaffUserMutation()
  const [resendInvitation, resendState] = useResendInvitationMutation()
  const [uploadFile, { isLoading: isUploading, isError: isUploadError, error: uploadError }] =
    useUploadFileMutation()
  const isBusy = createState.isLoading || updateState.isLoading
  const [isActive, setIsActive] = useState(true)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; mode: AccessMode } | null>(null)
  const [confirmingBaja, setConfirmingBaja] = useState(false)
  const { isIntroOpen: showIntro, dismissIntro } = useIntroSeen('create-user')
  const photoInputRef = useRef<HTMLInputElement>(null)

  /* Los mensajes del esquema se resuelven al armarlo, así que se rearma al
     cambiar de idioma: `i18n` no cambia de identidad al activar otro (D-36). */
  const schema = useMemo(() => buildUserFormSchema(i18n), [i18n, i18n.locale])

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      roleCode: '',
      reportsToUserId: NOBODY,
      accessMode: 'INVITATION',
      locale: 'es',
      password: '',
    },
  })

  const accessMode = watch('accessMode')
  const fullName = watch('fullName')
  const roleCode = watch('roleCode')

  /**
   * Zonas del Inspector: el campo solo existe con ese rol elegido — aparece
   * y desaparece con `roleCode`, nunca queda a medio llenar de un rol
   * anterior porque el envío ignora `selectedZones` si `isInspectorRole` es
   * falso en ese momento.
   */
  const isInspectorRole = roleCode === INSPECTOR_ROLE_CODE
  const [setUserZones] = useSetUserZonesMutation()
  const { data: zoneOptions = [] } = useGetZoneOptionsQuery(undefined, {
    skip: !isOpen || !isInspectorRole,
  })
  const { data: existingZones } = useGetUserZonesQuery(user?.id ?? '', {
    skip: !isOpen || !isEditing || !isInspectorRole,
  })
  const [selectedZones, setSelectedZones] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isOpen) return
    setSelectedZones(new Set((existingZones ?? []).map((zone) => zone.id)))
  }, [isOpen, user, existingZones])

  function toggleZone(zoneId: string): void {
    setSelectedZones((previous) => {
      const next = new Set(previous)
      if (next.has(zoneId)) next.delete(zoneId)
      else next.add(zoneId)
      return next
    })
  }

  /** Los jefes posibles dependen del rol elegido (SUPERIOR_ROLES). */
  const allowedSuperiors = SUPERIOR_ROLES[roleCode]
  const superiorOptions = reportsToOptions.filter(
    (option) =>
      option.id !== user?.id &&
      (allowedSuperiors === undefined || allowedSuperiors.includes(option.role.code)),
  )
  const reportsToUserId = watch('reportsToUserId')

  /**
   * El jefe se propone solo: con UN candidato posible se preselecciona (se
   * puede quitar), y al cambiar de rol un jefe que dejó de ser válido se
   * limpia en vez de quedarse guardado en silencio.
   */
  /** Un auto-pick por rol: si la persona luego elige «Nadie», se respeta. */
  const autoPickedForRole = useRef<string | null>(null)

  useEffect(() => {
    if (!isOpen || !roleCode) return
    const isValid =
      reportsToUserId === NOBODY || superiorOptions.some((option) => option.id === reportsToUserId)
    if (!isValid) {
      setValue('reportsToUserId', NOBODY)
      return
    }
    if (
      reportsToUserId === NOBODY &&
      superiorOptions.length === 1 &&
      autoPickedForRole.current !== roleCode
    ) {
      autoPickedForRole.current = roleCode
      setValue('reportsToUserId', superiorOptions[0]?.id ?? NOBODY)
    }
    /* `superiorOptions` es derivado de roleCode y de la lista: alcanza con estos. */
  }, [isOpen, roleCode, reportsToUserId, reportsToOptions.length])

  useEffect(() => {
    if (!isOpen) return
    createState.reset()
    updateState.reset()
    resendState.reset()
    setIsActive(user?.isActive ?? true)
    setCreated(null)
    setConfirmingBaja(false)
    setPhotoPath(null)
    setPhotoPreview(user?.photoUrl ?? null)
    reset({
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      roleCode: user?.role.code ?? '',
      reportsToUserId: user?.reportsToUserId ?? NOBODY,
      accessMode: 'INVITATION',
      /* Al reabrir SIEMPRE vuelve a español: es un campo del alta, y una
         cuenta ya creada cambia su idioma desde su propia cuenta, no aquí. */
      locale: 'es',
      password: '',
    })
  }, [isOpen, user, reset])

  async function onPhotoPicked(file: File): Promise<void> {
    const uploaded = await uploadFile({ file, purpose: 'USER_PHOTO' }).unwrap()
    setPhotoPath(uploaded.path)
    setPhotoPreview(uploaded.url ?? URL.createObjectURL(file))
    toast.success(t`Foto subida`)
  }

  /**
   * Se guarda AL FINAL, con el usuario ya creado/actualizado: si esto falla
   * el alta o la edición ya se guardaron, así que avisa aparte en vez de
   * tumbar el flujo principal — se puede reintentar reabriendo el editar.
   */
  async function saveZonesIfNeeded(userId: string, savedRoleCode: string): Promise<void> {
    if (savedRoleCode !== INSPECTOR_ROLE_CODE) return
    if (!isEditing && selectedZones.size === 0) return
    try {
      await setUserZones({ userId, zoneIds: [...selectedZones] }).unwrap()
    } catch {
      toast.error(t`El usuario se guardó, pero sus zonas no: ábrelo de nuevo para reintentar.`)
    }
  }

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
          ...(photoPath ? { photoPath } : {}),
        },
      }).unwrap()
      await saveZonesIfNeeded(user.id, values.roleCode)
    } else {
      const newUser = await createUser({
        email: values.email,
        fullName: values.fullName,
        roleCode: values.roleCode,
        locale: values.locale,
        ...(reportsToUserId ? { reportsToUserId } : {}),
        ...(values.accessMode === 'PASSWORD' ? { password: values.password } : {}),
        ...(photoPath ? { photoPath } : {}),
      }).unwrap()
      await saveZonesIfNeeded(newUser.id, values.roleCode)
      toast.success(
        values.accessMode === 'INVITATION'
          ? t`Usuario creado — invitación enviada a ${values.email}`
          : t`Usuario creado`,
      )
      setCreated({ email: values.email, mode: values.accessMode })
      return
    }
    toast.success(
      user?.isActive === false && isActive ? t`Usuario activado` : t`Usuario actualizado`,
    )
    onClose()
  }

  async function darDeBaja(): Promise<void> {
    if (!isEditing) return
    await updateUser({ id: user.id, body: { isActive: false } }).unwrap()
    toast.success(t`Usuario dado de baja`)
    onClose()
  }

  const saveError = createState.error ?? updateState.error
  const initials = initialsOf(fullName)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t`Editar usuario` : t`Nuevo usuario`}
      chromeless
      className="max-w-2xl"
    >
      <div className="flex max-h-[calc(100vh-3rem)] flex-col overflow-y-auto">
        {showIntro && !isEditing ? (
          <OnboardingIntro
            slides={INTRO_SLIDES.map((slide) => ({
              image: slide.image,
              title: i18n._(slide.title),
              text: i18n._(slide.text),
            }))}
            startLabel={t`Comenzar el alta`}
            onDone={() => {
              dismissIntro()
            }}
          />
        ) : (
          <>
            <div className="relative h-32 shrink-0 bg-gradient-to-r from-o-50 via-o-50/70 to-surface-2">
              <img
                src={personajeBienvenida}
                alt=""
                aria-hidden
                className="absolute right-10 bottom-2 h-28 w-auto"
              />
              <button
                type="button"
                aria-label={photoPreview ? t`Reemplazar foto` : t`Subir foto`}
                title={photoPreview ? t`Reemplazar foto` : t`Subir foto`}
                disabled={isUploading}
                onClick={() => {
                  photoInputRef.current?.click()
                }}
                className="group absolute -bottom-11 left-8 z-10 size-22 cursor-pointer rounded-full border-4 border-surface bg-o-50 shadow-md transition-shadow hover:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-o-500 disabled:cursor-wait"
              >
                {isUploading && (
                  <span className="absolute inset-0 z-10 flex items-center justify-center rounded-full bg-surface/75">
                    <span
                      aria-hidden
                      className="size-7 animate-spin rounded-full border-[3px] border-o-500 border-t-transparent"
                    />
                  </span>
                )}
                <span className="block size-full overflow-hidden rounded-full">
                  {photoPreview ? (
                    <img src={photoPreview} alt="" className="size-full object-cover" />
                  ) : initials !== '' ? (
                    <span
                      aria-hidden
                      className="flex size-full items-center justify-center text-xl font-bold text-o-700"
                    >
                      {initials}
                    </span>
                  ) : (
                    <span aria-hidden className="flex size-full items-center justify-center">
                      <MaterialIcon name="photo_camera" className="text-2xl text-o-700" />
                    </span>
                  )}
                  <span
                    aria-hidden
                    className="absolute inset-x-1 bottom-1 rounded-full bg-ink/60 py-0.5 text-center text-[10px] font-semibold text-surface opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    {isUploading ? t`Subiendo…` : photoPreview ? t`Cambiar` : t`Subir foto`}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full border-2 border-surface bg-o-500 text-ink shadow-sm"
                >
                  <MaterialIcon name="photo_camera" className="text-sm" />
                </span>
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void onPhotoPicked(file)
                  event.target.value = ''
                }}
              />
            </div>

            <header className="px-8 pt-14 pb-5">
              <h2 className="text-xl font-bold text-ink">
                {fullName.trim() === '' ? t`Nuevo usuario` : fullName}
              </h2>
              <p className="mt-0.5 text-xs text-ink-3">
                {isEditing ? t`Editar personal del sistema` : t`Alta de personal del sistema`}
                {IS_DEV_UI && <code className="text-[11px] text-ink-4"> · identity.user</code>}
              </p>
              {isUploadError && (
                <p role="alert" className="mt-1 text-xs text-red">
                  {uploadErrorMessage(uploadError, i18n)}
                </p>
              )}
            </header>

            {created ? (
              <div className="flex flex-col items-center gap-3 border-t border-line px-8 py-12 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-green/10">
                  <MaterialIcon name="mark_email_read" className="text-3xl text-green" />
                </span>
                <p className="text-lg font-bold text-ink">
                  {created.mode === 'INVITATION' ? t`Invitación enviada a:` : t`Usuario creado`}
                </p>
                <p className="text-sm font-semibold text-o-700">{created.email}</p>
                <p className="max-w-sm text-xs leading-relaxed text-ink-3">
                  {created.mode === 'INVITATION'
                    ? t`La persona recibirá un correo para establecer su contraseña. Hasta que entre por primera vez, su cuenta aparece como «Invitación enviada».`
                    : t`Ya puede entrar con la contraseña que definiste. Compártesela por un canal seguro — no viaja por correo.`}
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
                    placeholder="ana@oranjepeople.com"
                    disabled={isEditing}
                    className={cn(isEditing && 'cursor-not-allowed bg-surface-2')}
                  />
                  <p className="text-xs text-ink-3">
                    {isEditing
                      ? t`Cambiar de persona es dar de baja este usuario y dar de alta al nuevo.`
                      : t`No se podrá cambiar después del alta: es el correo con el que la persona entra.`}
                  </p>
                  {errors.email && <p className="text-xs text-red">{errors.email.message}</p>}
                </FormRow>

                <FormRow label={t`Rol`} column="role_id">
                  <Controller
                    control={control}
                    name="roleCode"
                    render={({ field }) => (
                      <Select
                        {...(field.value ? { value: field.value } : {})}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger aria-label={t`Rol`} className="w-full">
                          <SelectValue placeholder={t`Elige el rol`} />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) =>
                            PENDING_ROLES.has(role.code) ? (
                              <SelectItem key={role.code} value={role.code} disabled>
                                <Trans>{role.name} — próximamente</Trans>
                              </SelectItem>
                            ) : (
                              <SelectItem key={role.code} value={role.code}>
                                {role.name}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-ink-3">
                    <Trans>
                      Solo roles internos de Oranje — las cuentas de los hoteles van en «Personal de
                      hoteles».
                    </Trans>
                  </p>
                  {errors.roleCode && <p className="text-xs text-red">{errors.roleCode.message}</p>}
                </FormRow>

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
                          {/* En su propio idioma, como el interruptor del login: quien
                              elige «English» lo reconoce aunque no lea español. */}
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

                {isInspectorRole && (
                  <FormRow label={t`Zonas`} column="commercial.user_zone">
                    {zoneOptions.length === 0 ? (
                      <p className="text-xs text-ink-3">
                        <Trans>No hay zonas en el catálogo todavía.</Trans>
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {zoneOptions.map((zone) => (
                          <li key={zone.id}>
                            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-line p-2.5 transition-colors hover:bg-surface-2 has-checked:border-o-500 has-checked:bg-o-50">
                              <input
                                type="checkbox"
                                checked={selectedZones.has(zone.id)}
                                onChange={() => {
                                  toggleZone(zone.id)
                                }}
                                className="size-4 accent-o-500"
                              />
                              <span className="text-sm font-medium text-ink">{zone.name}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-ink-3">
                      {selectedZones.size === 0 ? (
                        <Trans>
                          Sin zonas elegidas el Inspector no ve ningún hotel para levantar
                          requisiciones ni auditar.
                        </Trans>
                      ) : (
                        <Trans>Solo verá los hoteles de estas zonas — nunca todos.</Trans>
                      )}
                    </p>
                  </FormRow>
                )}

                <FormRow label={t`Reporta a`} column="reports_to_user_id">
                  <Controller
                    control={control}
                    name="reportsToUserId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label={t`Reporta a`} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NOBODY}>
                            {allowedSuperiors !== undefined && allowedSuperiors.length === 0
                              ? t`Nadie — la punta de la jerarquía`
                              : t`Nadie (sin jefe por ahora)`}
                          </SelectItem>
                          {superiorOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.fullName} · {option.role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-ink-3">
                    {allowedSuperiors !== undefined && allowedSuperiors.length === 0
                      ? t`El Administrador no reporta a nadie.`
                      : roleCode && superiorOptions.length === 0
                        ? t`Aún no hay nadie dado de alta con el rol al que reporta. Da de alta primero a esa persona.`
                        : t`Solo se ofrecen los superiores del rol elegido: el BD apunta a su BDC, la Reclutadora a su Líder.`}
                  </p>
                  {roleCode &&
                    reportsToUserId === NOBODY &&
                    allowedSuperiors !== undefined &&
                    allowedSuperiors.length > 0 &&
                    superiorOptions.length > 0 && (
                      <p className="text-xs font-medium text-o-700">
                        <Trans>
                          Este rol normalmente reporta a alguien: sin jefe no aparecerá en ningún
                          «Mi Equipo».
                        </Trans>
                      </p>
                    )}
                </FormRow>

                {!isEditing && (
                  <FormRow label={t`Acceso`} column="firebase_uid · primer login">
                    <Controller
                      control={control}
                      name="accessMode"
                      render={({ field }) => (
                        <div className="flex w-fit gap-1 rounded-xl bg-surface-2 p-1">
                          {(
                            [
                              ['INVITATION', t`Enviar invitación por correo`],
                              ['PASSWORD', t`Definir contraseña`],
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
                    {accessMode === 'INVITATION' ? (
                      <p className="rounded-xl bg-o-50 px-4 py-3 text-xs leading-relaxed text-o-700">
                        <Trans>
                          Aquí no se captura contraseña: al crear, la persona recibe un correo de
                          invitación y establece la suya. Hasta que entre por primera vez, la cuenta
                          aparece como «Invitación enviada».
                        </Trans>
                      </p>
                    ) : (
                      <>
                        <PasswordInput aria-label={t`Contraseña`} {...register('password')} />
                        <p className="text-xs text-ink-3">
                          <Trans>
                            Es su contraseña de uso: puede cambiarla cuando quiera con «¿Olvidaste
                            tu contraseña?». No se envía por correo.
                          </Trans>
                        </p>
                        {errors.password && (
                          <p className="text-xs text-red">{errors.password.message}</p>
                        )}
                      </>
                    )}
                  </FormRow>
                )}

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
                            void resendInvitation(user.id).then(() => {
                              toast.success(t`Invitación enviada`)
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
                    {apiErrorMessage(saveError, i18n)}
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
                    {isBusy ? t`Guardando…` : isEditing ? t`Guardar cambios` : t`Crear usuario`}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
