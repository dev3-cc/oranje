import { Controller, Get, Query } from '@nestjs/common'

import { Requires } from '../../../common/decorators/index.js'
import { TimelinessQueryDto } from '../../observability/approval-timeliness/approval-timeliness.dto.js'
import {
  ApprovalTimeliness,
  ApprovalTimelinessService,
} from '../../observability/approval-timeliness/approval-timeliness.service.js'

import { ListPendingApprovalsDto } from './dto/pending-approvals.dto.js'
import { PendingApprovalsService, PendingApprovalWeek } from './pending-approvals.service.js'

@Controller('pending-approvals')
export class PendingApprovalsController {
  constructor(
    private readonly pending: PendingApprovalsService,
    private readonly timeliness: ApprovalTimelinessService,
  ) {}

  @Requires('payroll', 'read')
  @Get()
  async list(@Query() query: ListPendingApprovalsDto): Promise<{ data: PendingApprovalWeek[] }> {
    return { data: await this.pending.list(query) }
  }

  /* KPI 4 (Aprobación oportuna de ponches), para Contabilidad. Misma fuente que Observabilidad. */
  @Requires('payroll', 'read')
  @Get('timeliness')
  async approvalTimeliness(
    @Query() query: TimelinessQueryDto,
  ): Promise<{ data: ApprovalTimeliness }> {
    return { data: await this.timeliness.compute(query.weeks) }
  }
}
