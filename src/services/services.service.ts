import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { StaffService } from './entities/staff-service.entity';
import {
  CreateServiceDto,
  SetOfferingsDto,
  UpdateServiceDto,
} from './dto/service.dto';
import { Business } from '../business/entities/business.entity';
import { Users } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { effectiveOffering, EffectiveOffering } from './offering';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  async create(business: Business, dto: CreateServiceDto): Promise<Service> {
    return this.serviceRepository.save(
      this.serviceRepository.create({
        ...dto,
        description: dto.description ?? null,
        buffer_minutes: dto.buffer_minutes ?? 0,
        business: { id: business.id } as Business,
        offerings: [],
      }),
    );
  }

  /** Every service of the business (active or not), with offerings. */
  async listForOwner(business: Business): Promise<Service[]> {
    return this.withOfferings()
      .where('service.businessId = :businessId', { businessId: business.id })
      .orderBy('service.name', 'ASC')
      .getMany();
  }

  /** Active services clients can book, with who offers them. */
  async listPublic(businessId: string): Promise<Service[]> {
    return this.withOfferings()
      .where('service.businessId = :businessId', { businessId })
      .andWhere('service.active = true')
      .orderBy('service.name', 'ASC')
      .getMany();
  }

  async update(
    business: Business,
    id: string,
    dto: UpdateServiceDto,
  ): Promise<Service> {
    const service = await this.getOwned(business, id);
    Object.assign(service, dto);
    await this.serviceRepository.save(service);
    return this.getOwned(business, id);
  }

  /** Soft delete: past bookings keep pointing at it. */
  async deactivate(business: Business, id: string): Promise<void> {
    const service = await this.getOwned(business, id);
    service.active = false;
    await this.serviceRepository.save(service);
  }

  /** Replaces the set of staff offering the service. */
  async setOfferings(
    business: Business,
    id: string,
    dto: SetOfferingsDto,
  ): Promise<Service> {
    const service = await this.getOwned(business, id);
    for (const offering of dto.staff) {
      if (
        !(await this.usersService.findStaffMember(
          offering.staffId,
          business.id,
        ))
      ) {
        throw new BadRequestException(
          `User ${offering.staffId} is not staff of this business`,
        );
      }
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(StaffService, { service: { id: service.id } });
      await manager.save(
        dto.staff.map((o) =>
          manager.create(StaffService, {
            service: { id: service.id } as Service,
            staff: { id: o.staffId } as Users,
            duration_minutes: o.duration_minutes ?? null,
            buffer_minutes: o.buffer_minutes ?? null,
            price_minor: o.price_minor ?? null,
          }),
        ),
      );
    });
    return this.getOwned(business, id);
  }

  /**
   * A bookable service of a business with its effective terms per staff
   * member, optionally narrowed to one staff member.
   */
  async bookableOfferings(
    businessId: string,
    serviceId: string,
    staffId?: number,
  ): Promise<{ service: Service; offerings: EffectiveOffering[] }> {
    const service = await this.withOfferings()
      .where('service.id = :serviceId', { serviceId })
      .andWhere('service.businessId = :businessId', { businessId })
      .andWhere('service.active = true')
      .getOne();
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    const offerings = service.offerings
      .filter((o) => !staffId || o.staff.id === staffId)
      .map((o) => effectiveOffering(service, o))
      .sort((a, b) => a.staffId - b.staffId);
    if (offerings.length === 0) {
      throw new NotFoundException(
        staffId
          ? 'This staff member does not offer the service'
          : 'Nobody offers this service yet',
      );
    }
    return { service, offerings };
  }

  private async getOwned(business: Business, id: string): Promise<Service> {
    const service = await this.withOfferings()
      .where('service.id = :id', { id })
      .getOne();
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    const owner = await this.serviceRepository
      .createQueryBuilder('service')
      .select('service.businessId', 'businessId')
      .where('service.id = :id', { id })
      .getRawOne<{ businessId: string }>();
    if (owner?.businessId !== business.id) {
      throw new ForbiddenException('This service belongs to another business');
    }
    return service;
  }

  private withOfferings() {
    return this.serviceRepository
      .createQueryBuilder('service')
      .leftJoinAndSelect('service.offerings', 'offering')
      .leftJoin('offering.staff', 'staff')
      .addSelect('staff.id');
  }
}
