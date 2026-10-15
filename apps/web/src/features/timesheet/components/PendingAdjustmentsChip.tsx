import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon, Popover, PopoverContent, PopoverTrigger, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

// Mismo diálogo y mismo endpoint que «Ajustes a incluir»: incluir desde aquí
// es la MISMA decisión de Contabilidad, no una segunda (Hugo, 2026-10-14).
// eslint-disable-next-line no-restricted-imports
import { IncludeAdjustmentDialog } from '@/features/accounting/components/IncludeAdjustmentDialog'
import { useIncludePayAdjustmentMutation, type PayAdjustment } from '@/features/recruitment'
import { SettlementEffectBadge } from '@/shared/components/SettlementEffectBadge'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatMoney } from '@/shared/lib/formatters'

/**
 * Lo que el Observador ya aprobó para esta persona y Contabilidad todavía no
 * decidió si pesa en la nómina — opcional sumarlo, uno por uno (Hugo,
 * 2026-10-14: "¿estamos consumiendo los datos del contrato? ... sea opcional
 * sumarlo"). Por trabajador, no por semana exacta: el ajuste vive en la
 * asignación eventual y no siempre hay una forma honesta de acotarlo a una
 * semana desde aquí — se dice así, no se adivina.
 */
export function PendingAdjustmentsChip({
  adjustments,
}: {
  adjustments: PayAdjustment[]
}): ReactNode {
  const { t } = useLingui()
  const [isOpen, setIsOpen] = useState(false)
  const [target, setTarget] = useState<PayAdjustment | null>(null)
  const [include, { isLoading: isIncluding }] = useIncludePayAdjustmentMutation()

  if (adjustments.length === 0) return null

  async function confirmInclude(): Promise<void> {
    if (!target) return
    try {
      await include({ id: target.id }).unwrap()
      toast.success(t`Incluido en la nómina`)
      setTarget(null)
    } catch (error) {
      toast.error(apiErrorMessage(error, { fallback: t`No se pudo incluir. Inténtalo de nuevo.` }))
    }
  }

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex cursor-pointer touch-manipulation items-center gap-1.5 rounded-md border border-dashed border-o-500 bg-o-50 px-2.5 py-1.5 text-xs font-semibold text-o-700"
          >
            <MaterialIcon name="receipt_long" className="text-sm" aria-hidden />
            <Plural
              value={adjustments.length}
              one="# ajuste sin incluir"
              other="# ajustes sin incluir"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-80 p-3"
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          <p className="mb-2 text-xs text-ink-3">
            <Trans>
              Aprobados por el Observador, sin decidir si pesan en esta nómina. Inclúyelos uno por
              uno.
            </Trans>
          </p>
          <ul className="flex flex-col gap-2">
            {adjustments.map((adjustment) => (
              <li
                key={adjustment.id}
                className="flex flex-col gap-1.5 rounded-md border border-line p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {formatMoney(Number(adjustment.amount))}
                  </span>
                  {adjustment.settlementEffect && (
                    <SettlementEffectBadge effect={adjustment.settlementEffect} />
                  )}
                </div>
                <p className="text-xs text-ink-3">
                  {adjustment.payConcept ? (
                    <Trans>Gasto: {adjustment.payConcept.name}</Trans>
                  ) : (
                    <Trans>Ajuste a la tarifa de la posición</Trans>
                  )}
                </p>
                <p className="text-xs text-ink-4">«{adjustment.reason}»</p>
                <button
                  type="button"
                  onClick={() => {
                    setTarget(adjustment)
                    setIsOpen(false)
                  }}
                  className="mt-1 cursor-pointer self-start rounded-md bg-o-500 px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:bg-o-400"
                >
                  <Trans>Incluir</Trans>
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      <IncludeAdjustmentDialog
        isOpen={target !== null}
        target={target}
        isIncluding={isIncluding}
        onClose={() => {
          setTarget(null)
        }}
        onConfirm={() => {
          void confirmInclude()
        }}
      />
    </>
  )
}
