import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateBusinessDto } from './create-business.dto.js';

// Timezone and currency can't be changed yet: bookings are stored as
// absolute instants with a price snapshot, so both would silently shift.
export class UpdateBusinessDto extends PartialType(
  OmitType(CreateBusinessDto, ['timezone', 'currency'] as const),
) {}
