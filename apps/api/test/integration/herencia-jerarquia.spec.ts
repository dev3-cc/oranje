import { PERMISSIONS, ROLE_INHERITANCE, expandRoles } from '../../prisma/permissions.js'

import { close, db } from './db.js'

/**
 * Herencia por jerarquía (Reglas de Negocio, 2026-09-14): quien tiene
 * subordinados hereda sus permisos y sus transiciones de semáforo. Se resuelve
 * al sembrar, así que lo que se prueba aquí es la base sembrada: cada fila del
 * subordinado existe para su jefe, y nada baja del jefe al subordinado.
 */
const CADENAS: Array<[jefe: string, subordinado: string]> = [
  ['ROL-V-02', 'ROL-V-01'],
  ['ROL-R-02', 'ROL-R-01'],
  ['ROL-R-03', 'ROL-R-02'],
  ['ROL-R-03', 'ROL-R-01'],
  ['ROL-H-02', 'ROL-H-01'],
  ['ROL-H-03', 'ROL-H-02'],
  ['ROL-H-03', 'ROL-H-01'],
  ['ROL-I-02', 'ROL-I-01'],
]

afterAll(close)

/** Filas fuera de la herencia (`inherit: false`): hoy, Auditorías. */
const SIN_HERENCIA = new Set(
  PERMISSIONS.filter((p) => p.inherit === false).map((p) => `${p.module}:${p.action}`),
)

async function permisosDe(code: string): Promise<Set<string>> {
  const rows = await db.rolePermission.findMany({
    where: { role: { code } },
    select: { module: true, action: true },
  })
  return new Set(rows.map((r) => `${r.module}:${r.action}`).filter((k) => !SIN_HERENCIA.has(k)))
}

async function transicionesDe(code: string): Promise<Set<string>> {
  const rows = await db.statusLightTransition.findMany({
    where: { authorizedRole: { code } },
    select: { fromStateId: true, toStateId: true },
  })
  return new Set(rows.map((r) => `${r.fromStateId}>${r.toStateId ?? ''}`))
}

describe('expandRoles', () => {
  it('agrega al jefe y nunca al subordinado', () => {
    expect(expandRoles(['ROL-V-01']).sort()).toEqual(['ROL-V-01', 'ROL-V-02'])
    expect(expandRoles(['ROL-R-01']).sort()).toEqual(['ROL-R-01', 'ROL-R-02', 'ROL-R-03'])
    expect(expandRoles(['ROL-H-01']).sort()).toEqual(['ROL-H-01', 'ROL-H-02', 'ROL-H-03'])
    expect(expandRoles(['ROL-V-02'])).toEqual(['ROL-V-02'])
    expect(expandRoles(['ROL-R-02']).sort()).toEqual(['ROL-R-02', 'ROL-R-03'])
  })

  it('deja fuera a Contabilidad, QA, CS, el Colaborador, el Administrador y el Sistema', () => {
    for (const code of [
      'ROL-CO-01',
      'ROL-CO-02',
      'ROL-Q-01',
      'ROL-Q-02',
      'ROL-CS-01',
      'ROL-CS-02',
      'ROL-C-01',
      'ROL-ADM-01',
      'ROL-SYS-01',
    ]) {
      expect(expandRoles([code])).toEqual([code])
    }
    expect(Object.keys(ROLE_INHERITANCE).sort()).toEqual([
      'ROL-H-02',
      'ROL-H-03',
      'ROL-I-02',
      'ROL-R-02',
      'ROL-R-03',
      'ROL-V-02',
    ])
  })
})

describe('la base sembrada respeta la herencia', () => {
  it.each(CADENAS)('%s tiene todos los permisos de %s', async (jefe, subordinado) => {
    const del = await permisosDe(subordinado)
    const delJefe = await permisosDe(jefe)
    expect(del.size).toBeGreaterThan(0)
    expect([...del].filter((p) => !delJefe.has(p))).toEqual([])
  })

  it.each(CADENAS)('%s tiene todas las transiciones de %s', async (jefe, subordinado) => {
    const del = await transicionesDe(subordinado)
    const delJefe = await transicionesDe(jefe)
    expect([...del].filter((t) => !delJefe.has(t))).toEqual([])
  })

  /* Ampliado el 2026-09-24: el Inspector también audita (sus hoteles de
     zona), pero sigue sin heredarse hacia el Coordinador — mismo criterio
     de "sin herencia" que ya protegía al Supervisor. */
  it('lo marcado sin herencia se queda en su rol: Auditorías es del Supervisor y el Inspector', async () => {
    expect([...SIN_HERENCIA].sort()).toEqual(['audits:create', 'audits:read', 'audits:update'])
    const rows = await db.rolePermission.findMany({
      where: { module: 'audits' },
      select: { role: { select: { code: true } } },
    })
    expect(new Set(rows.map((r) => r.role.code))).toEqual(
      new Set(['ROL-H-01', 'ROL-I-01', 'ROL-SYS-01']),
    )
  })

  it('la herencia no sube: el BD no gana lo exclusivo del BDC', async () => {
    const bd = await permisosDe('ROL-V-01')
    expect(bd.has('conversion:create_hotel_user')).toBe(false)
    expect(bd.has('territory:assign')).toBe(false)
  })
})
