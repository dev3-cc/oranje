import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const url = process.env['MIGRATE_DATABASE_URL']

export const db = new PrismaClient({
  // La instancia de dev es la de staging y tiene 25 conexiones en total: el
  // pool por default (10) de cada suite, más los API locales, la agotaban y
  // staging respondía 500 mientras corrían las pruebas. Con maxWorkers 1,
  // tres conexiones sobran.
  adapter: new PrismaPg({ connectionString: url, application_name: 'oranje-tests', max: 3 }),
})

export async function close(): Promise<void> {
  await db.$disconnect()
}
