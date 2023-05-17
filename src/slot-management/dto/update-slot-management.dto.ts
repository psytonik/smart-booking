import { PartialType } from '@nestjs/swagger';
import { CreateSlotManagementDto } from './create-slot-management.dto';

export class UpdateSlotManagementDto extends PartialType(
  CreateSlotManagementDto,
) {}
