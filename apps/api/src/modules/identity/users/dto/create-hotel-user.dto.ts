import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const HOTEL_ROLES = ['ROL-H-01', 'ROL-H-02', 'ROL-H-03'] as const
export const GENERAL_MANAGER = 'ROL-H-03'

export const createHotelUserSchema = z.object({
  email: z.email().trim().toLowerCase().max(255),
  fullName: z.string().trim().min(1).max(160),
  roleCode: z.enum(HOTEL_ROLES),
  departmentId: z.uuid().optional(),
  reportsToUserId: z.uuid().optional(),
})

export class CreateHotelUserDto extends createZodDto(createHotelUserSchema) {}
