import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateBusinessDto } from './create-business.dto';

// The timezone can't be changed yet: existing slots are stored as absolute
// instants, so their local times would silently shift.
export class UpdateBusinessDto extends PartialType(
  OmitType(CreateBusinessDto, ['timezone'] as const),
) {}
