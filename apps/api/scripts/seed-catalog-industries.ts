import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import { HOTEL_DEPARTMENTS, INDUSTRIES, POSITIONS } from '../prisma/seed-data/catalog-industries.js'

/**
 * El INSERT aditivo del catálogo de Industrias/Posiciones (Hugo, 2026-10-17),
 * para correr contra una base compartida (dev/staging/producción) SIN volver
 * a correr `prisma/seed.ts` completo — ese resiembra `role_permission` con el
 * código de quien lo corre y puede revocar permisos de ramas ajenas. Mismo
 * criterio que el resto del catálogo: cada fila se identifica por su `code`
 * y se hace upsert, así que correrlo dos veces no duplica nada.
 */
const connectionString = process.env['MIGRATE_DATABASE_URL'] ?? process.env['DATABASE_URL'] ?? ''
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

function log(line: string): void {
  process.stdout.write(`${line}\n`)
}

async function main(): Promise<void> {
  for (const d of HOTEL_DEPARTMENTS) {
    await prisma.hotelDepartment.upsert({
      where: { code: d.code },
      update: { name: d.name },
      create: { id: uuidv7(), code: d.code, name: d.name },
    })
  }
  log(`hotel_department: ${String(HOTEL_DEPARTMENTS.length)}`)

  for (const i of INDUSTRIES) {
    await prisma.industry.upsert({
      where: { code: i.code },
      update: { name: i.name },
      create: { id: uuidv7(), code: i.code, name: i.name },
    })
  }
  log(`industry: ${String(INDUSTRIES.length)}`)

  for (const p of POSITIONS) {
    const industry = await prisma.industry.findUniqueOrThrow({ where: { code: p.industry } })
    const dept = p.department
      ? await prisma.hotelDepartment.findUniqueOrThrow({ where: { code: p.department } })
      : null
    await prisma.catalogPosition.upsert({
      where: { code: p.code },
      update: { name: p.name, industryId: industry.id, hotelDepartmentId: dept?.id ?? null },
      create: {
        id: uuidv7(),
        code: p.code,
        name: p.name,
        industryId: industry.id,
        hotelDepartmentId: dept?.id ?? null,
      },
    })
  }
  log(`catalogs.position: ${String(POSITIONS.length)}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e: unknown) => {
    await prisma.$disconnect()
    process.stderr.write(`${String(e)}\n`)
    process.exit(1)
  })
