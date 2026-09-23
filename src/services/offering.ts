import { Service } from './entities/service.entity.js';
import { StaffService } from './entities/staff-service.entity.js';

/** What booking a service with one staff member actually means. */
export interface EffectiveOffering {
  staffId: number;
  durationMinutes: number;
  bufferMinutes: number;
  priceMinor: number;
}

export function effectiveOffering(
  service: Service,
  offering: StaffService,
): EffectiveOffering {
  return {
    staffId: offering.staff.id,
    durationMinutes: offering.duration_minutes ?? service.duration_minutes,
    bufferMinutes: offering.buffer_minutes ?? service.buffer_minutes,
    priceMinor: offering.price_minor ?? service.price_minor,
  };
}
