import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infra/prisma/index.js'

export interface CatalogItem {
  id: string
  code: string
  name: string
}

export interface StatusLightItem {
  code: string
  color: string
  name: string
  isBranch: boolean
  displayOrder: number
}

export interface ReasonItem {
  id: string
  code: string
  name: string
  statusLight: string
}

@Injectable()
export class CatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  async zones(): Promise<CatalogItem[]> {
    return this.prisma.zone.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    })
  }

  async hotelDepartments(): Promise<CatalogItem[]> {
    return this.prisma.hotelDepartment.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    })
  }

  async positions(departmentId?: string): Promise<CatalogItem[]> {
    return this.prisma.catalogPosition.findMany({
      where: departmentId ? { hotelDepartmentId: departmentId } : {},
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    })
  }

  async hiringModalities(): Promise<CatalogItem[]> {
    return this.prisma.hiringModality.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    })
  }

  async englishLevels(): Promise<CatalogItem[]> {
    return this.prisma.englishLevel.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    })
  }

  async statusLights(): Promise<Array<{ code: string; name: string; states: StatusLightItem[] }>> {
    const lights = await this.prisma.statusLight.findMany({
      select: {
        code: true,
        name: true,
        states: {
          select: {
            code: true,
            color: true,
            name: true,
            isBranch: true,
            displayOrder: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    })

    return lights
  }

  async reasons(statusLightCode?: string): Promise<ReasonItem[]> {
    const rows = await this.prisma.statusChangeReason.findMany({
      where: statusLightCode ? { statusLight: { code: statusLightCode } } : {},
      select: {
        id: true,
        code: true,
        name: true,
        statusLight: { select: { code: true } },
      },
      orderBy: { name: 'asc' },
    })

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      statusLight: r.statusLight.code,
    }))
  }
}
