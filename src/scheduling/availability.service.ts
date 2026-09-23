import { Injectable } from '@nestjs/common';
import { Business } from '../business/entities/business.entity';
import { EffectiveOffering } from '../services/offering';
import { addMinutesTo, dayRange } from '../common/time';
import { availableStarts } from './availability';
import { ScheduleService } from './schedule.service';

export interface AvailableStart {
  start: Date;
  end: Date;
  staffId: number;
  price_minor: number;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly schedule: ScheduleService) {}

  /**
   * Free start times for a service over consecutive days, for each staff
   * member offering it, sorted by time then staff.
   */
  async compute(
    business: Business,
    offerings: EffectiveOffering[],
    days: string[],
    now: Date = new Date(),
  ): Promise<AvailableStart[]> {
    const range = {
      start: dayRange(days[0], business.timezone).start,
      // Busy time can reach into the next morning via buffers.
      end: dayRange(days[days.length - 1], business.timezone).end,
    };
    const calendar = await this.schedule.loadCalendar(
      offerings.map((o) => o.staffId),
      days,
      range,
    );

    const result: AvailableStart[] = [];
    for (const day of days) {
      for (const offering of offerings) {
        const starts = availableStarts({
          day,
          timeZone: business.timezone,
          working: calendar.workingFor(offering.staffId, day),
          busy: calendar.busyFor(offering.staffId),
          durationMinutes: offering.durationMinutes,
          bufferMinutes: offering.bufferMinutes,
          notBefore: now,
        });
        result.push(
          ...starts.map((start) => ({
            start,
            end: addMinutesTo(start, offering.durationMinutes),
            staffId: offering.staffId,
            price_minor: offering.priceMinor,
          })),
        );
      }
    }
    return result.sort(
      (a, b) => a.start.getTime() - b.start.getTime() || a.staffId - b.staffId,
    );
  }
}
