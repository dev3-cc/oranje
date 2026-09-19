import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { SignJWT } from 'jose'

const DEFAULT_TTL_S = 28_800

async function main(): Promise<void> {
  const ttl = Number(process.env['TOKEN_TTL_S'] ?? DEFAULT_TTL_S)
  const secret = process.env['JWT_SECRET']

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  })

  const email =
    [process.argv[2], process.env['AUTH_DEV_USER_EMAIL']].find((v) => v?.trim()) ??
    'dev@oranje.local'

  const user = await prisma.user.findFirst({
    where: { email, isActive: true },
    include: { role: true },
  })

  if (!user) {
    console.error(`No existe un usuario activo con correo ${email} en identity.user.`)
    console.error('Uso: pnpm token:local [correo]')
    process.exitCode = 1
  } else if (!secret) {
    console.error('Falta JWT_SECRET en apps/api/.env')
    process.exitCode = 1
  } else {
    const token = await new SignJWT({
      roleCode: user.role.code,
      hotelId: user.hotelId,
      departmentId: user.departmentId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer('oranje-api')
      .setAudience('oranje')
      .setIssuedAt()
      .setExpirationTime(`${ttl}s`)
      .sign(new TextEncoder().encode(secret))

    console.error(`${user.email} · ${user.role.code} · hotel=${user.hotelId ?? 'null'}`)
    console.log(token)
  }

  await prisma.$disconnect()
}

void main()
