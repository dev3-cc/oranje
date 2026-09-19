import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

/**
 * Rellena `place_id` y `photo_ref` de los hoteles que no los tienen.
 *
 * Las filas viejas guardaban la URL del SDK del navegador —con token de sesión,
 * hoy muerta— y ninguna trae place_id. Se re-resuelven por NOMBRE con Text
 * Search, que es lo único con lo que se cuenta; el que no case se queda sin
 * foto, que es honesto.
 *
 * Se corre a mano y una sola vez:  pnpm tsx scripts/resolver-fotos-hotel.ts
 */

const KEY = process.env['GOOGLE_PLACES_API_KEY']
const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'
const DETAILS_URL = 'https://places.googleapis.com/v1/places'

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env['MIGRATE_DATABASE_URL'] ?? process.env['DATABASE_URL'],
  }),
})

async function buscar(nombre: string, direccion: string | null): Promise<string | null> {
  const response = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY as string,
      'X-Goog-FieldMask': 'places.id',
    },
    body: JSON.stringify({
      textQuery: direccion ? `${nombre}, ${direccion}` : nombre,
      maxResultCount: 1,
    }),
  })

  if (!response.ok) {
    return null
  }

  const body = (await response.json()) as { places?: Array<{ id?: string }> }

  return body.places?.[0]?.id ?? null
}

async function foto(placeId: string): Promise<string | null> {
  const response = await fetch(`${DETAILS_URL}/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': KEY as string, 'X-Goog-FieldMask': 'photos' },
  })

  if (!response.ok) {
    return null
  }

  const body = (await response.json()) as { photos?: Array<{ name?: string }> }

  return body.photos?.[0]?.name ?? null
}

async function main(): Promise<void> {
  if (!KEY) {
    throw new Error('Falta GOOGLE_PLACES_API_KEY')
  }

  const hoteles = await prisma.hotel.findMany({
    where: { OR: [{ placeId: null }, { photoRef: null }] },
    select: { id: true, name: true, address: true, placeId: true },
  })

  let resueltos = 0

  for (const hotel of hoteles) {
    const placeId = hotel.placeId ?? (await buscar(hotel.name, hotel.address))

    if (!placeId) {
      process.stdout.write(`  sin coincidencia · ${hotel.name}\n`)
      continue
    }

    const photoRef = await foto(placeId)

    await prisma.hotel.update({
      where: { id: hotel.id },
      data: { placeId, photoRef, photoRefAt: new Date() },
    })

    resueltos += 1
    process.stdout.write(`  ${photoRef ? 'con foto  ' : 'sin foto  '} · ${hotel.name}\n`)
  }

  process.stdout.write(`\n${resueltos} de ${hoteles.length} resueltos\n`)
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`)
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
