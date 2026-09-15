import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@oranje/ui'
import { type ReactNode } from 'react'

import type { TerritoryOwner } from '../types/territory.types'

interface Props {
  owners: TerritoryOwner[]
  /** `null` = mi propio territorio. */
  selectedId: string | null
  onSelect: (id: string | null) => void
}

const MINE = 'mine'

/**
 * De quién es el territorio que se está mirando. Solo aparece para quien tiene
 * equipo: el BD no lo ve porque `/team` le responde vacío.
 */
export function TerritoryOwnerPicker({ owners, selectedId, onSelect }: Props): ReactNode {
  const { t } = useLingui()

  if (owners.length === 0) return null

  return (
    <Select
      value={selectedId ?? MINE}
      onValueChange={(value) => {
        onSelect(value === MINE ? null : value)
      }}
    >
      <SelectTrigger aria-label={t`De quién es el territorio`} className="mt-4 w-full">
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value={MINE}>
          <Trans>Mi territorio</Trans>
        </SelectItem>

        {owners.map((owner) => (
          <SelectItem key={owner.id} value={owner.id}>
            {owner.fullName} · <Plural value={owner.zoneCount} one="# zona" other="# zonas" /> ·{' '}
            <Plural value={owner.openProspects} one="# prospecto" other="# prospectos" />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
