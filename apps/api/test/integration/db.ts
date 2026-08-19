import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const url = process.env['MIGRATE_DATABASE_URL']

export const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, application_name: 'oranje-tests' }),
})

export async function close(): Promise<void> {
  await db.$disconnect()
}
