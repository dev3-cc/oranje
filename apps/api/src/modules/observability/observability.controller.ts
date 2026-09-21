import { Controller, Get, Query } from '@nestjs/common'

import { Requires } from '../../common/decorators/index.js'

import { QueryPunchesDto } from './dto/observability.dto.js'
import { PunchRow } from './observability.repository.js'
import {
  DepartmentMetric,
  ObservabilityService,
  StatusLightSummary,
} from './observability.service.js'

@Controller('observability')
export class ObservabilityController {
  constructor(private readonly observability: ObservabilityService) {}

  @Requires('observability', 'read_status_durations')
  @Get('status-durations')
  async statusDurations(): Promise<{ data: StatusLightSummary[] }> {
    return { data: await this.observability.statusLightDurations() }
  }

  @Requires('observability', 'read_punches')
  @Get('punches')
  async punches(@Query() query: QueryPunchesDto): Promise<{
    data: PunchRow[]
    meta: { total: number; page: number; limit: number; totalPages: number }
  }> {
    const { rows, total, page, limit, totalPages } = await this.observability.punches(query)
    return { data: rows, meta: { total, page, limit, totalPages } }
  }

  @Requires('observability', 'read_department_metrics')
  @Get('department-metrics')
  async departmentMetrics(): Promise<{ data: DepartmentMetric[] }> {
    return { data: await this.observability.departmentMetrics() }
  }
}
