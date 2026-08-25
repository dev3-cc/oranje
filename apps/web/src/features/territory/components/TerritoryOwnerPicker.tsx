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
  if (owners.length === 0) return null

  return (
    <Select
      value={selectedId ?? MINE}
      onValueChange={(value) => {
        onSelect(value === MINE ? null : value)
      }}
    >
      <SelectTrigger aria-label="Territorio de quién" className="mt-4 w-full">
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value={MINE}>Mi territorio</SelectItem>

        {owners.map((owner) => (
          <SelectItem key={owner.id} value={owner.id}>
            {owner.fullName} · {owner.zoneCount} zona{owner.zoneCount === 1 ? '' : 's'} ·{' '}
            {owner.openProspects} prospecto{owner.openProspects === 1 ? '' : 's'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
