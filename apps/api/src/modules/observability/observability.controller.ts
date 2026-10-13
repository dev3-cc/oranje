import { Controller, Get, Query } from '@nestjs/common'

import { Requires } from '../../common/decorators/index.js'

import { TimelinessQueryDto } from './approval-timeliness/approval-timeliness.dto.js'
import {
  ApprovalTimeliness,
  ApprovalTimelinessService,
} from './approval-timeliness/approval-timeliness.service.js'
import { QueryPunchesDto } from './dto/observability.dto.js'
import { PunchRow } from './observability.repository.js'
import {
  DepartmentMetric,
  ObservabilityService,
  StatusLightSummary,
} from './observability.service.js'

@Controller('observability')
export class ObservabilityController {
  constructor(
    private readonly observability: ObservabilityService,
    private readonly timeliness: ApprovalTimelinessService,
  ) {}

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

  /* KPI 4 (Aprobación oportuna de ponches). Misma fuente que Contabilidad. */
  @Requires('observability', 'read_department_metrics')
  @Get('approval-timeliness')
  async approvalTimeliness(
    @Query() query: TimelinessQueryDto,
  ): Promise<{ data: ApprovalTimeliness }> {
    return { data: await this.timeliness.compute(query.weeks) }
  }
}
