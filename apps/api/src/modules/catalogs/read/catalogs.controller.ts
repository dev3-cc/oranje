import { Controller, Get, Query } from '@nestjs/common'

import { CatalogItem, CatalogsService, ReasonItem, StatusLightItem } from './catalogs.service.js'

@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly catalogs: CatalogsService) {}

  @Get('zones')
  async zones(): Promise<{ data: CatalogItem[] }> {
    return { data: await this.catalogs.zones() }
  }

  @Get('hotel-departments')
  async hotelDepartments(): Promise<{ data: CatalogItem[] }> {
    return { data: await this.catalogs.hotelDepartments() }
  }

  @Get('positions')
  async positions(@Query('departmentId') departmentId?: string): Promise<{ data: CatalogItem[] }> {
    return { data: await this.catalogs.positions(departmentId) }
  }

  @Get('hiring-modalities')
  async hiringModalities(): Promise<{ data: CatalogItem[] }> {
    return { data: await this.catalogs.hiringModalities() }
  }

  @Get('english-levels')
  async englishLevels(): Promise<{ data: CatalogItem[] }> {
    return { data: await this.catalogs.englishLevels() }
  }

  @Get('status-lights')
  async statusLights(): Promise<{
    data: Array<{ code: string; name: string; states: StatusLightItem[] }>
  }> {
    return { data: await this.catalogs.statusLights() }
  }

  @Get('reasons')
  async reasons(@Query('statusLight') statusLight?: string): Promise<{ data: ReasonItem[] }> {
    return { data: await this.catalogs.reasons(statusLight) }
  }
}
