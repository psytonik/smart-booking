import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Business } from './entities/business.entity';
import { DataSource, Repository } from 'typeorm';
import { CreateBusinessDto } from './dto/create-business.dto';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { Users } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';
import { UsersService } from '../users/users.service';
import slugify from 'slugify';
import { GeocodingService } from './geocoding.service';
import { Location } from './entities/location.entity';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { errorMessage } from '../common/error-message';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    private readonly usersService: UsersService,
    private readonly geocodingService: GeocodingService,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<Business | null> {
    return await this.businessRepo.findOneBy({ id });
  }

  async findByOwnerId(userId: number): Promise<Business | null> {
    return await this.businessRepo.findOne({
      where: { owner: { id: userId } },
      relations: ['owner'],
    });
  }

  async findByEmployeeId(userId: number): Promise<Business | null> {
    return await this.businessRepo.findOne({
      where: { employees: { id: userId } },
    });
  }

  async openBusiness(
    createBusinessDto: CreateBusinessDto,
    user: ActiveUserData,
  ): Promise<Business> {
    const foundUser: Users = await this.usersService.findActiveUser(user.sub);
    if (foundUser.role === Role.Employee) {
      throw new ForbiddenException('Employees cannot open a business');
    }
    if (await this.findByOwnerId(foundUser.id)) {
      throw new ConflictException('You already own a business');
    }

    let formattedAddress: string;
    let coords: Location;
    try {
      ({ formattedAddress, coords } = await this.getLocationFromAddress(
        createBusinessDto.address,
      ));
    } catch (err) {
      throw new BadRequestException(
        `Could not resolve the given address: ${errorMessage(err)}`,
      );
    }

    const newBusiness: Business = this.businessRepo.create({
      ...createBusinessDto,
      employees: [],
      slots: [],
      address: formattedAddress,
      slug: await this.generateUniqueSlug(createBusinessDto.name),
    });
    // Assigned after create(): create() deep-copies nested entities, and the
    // copy would miss the id that saving `coords` below assigns.
    newBusiness.coords = coords;

    // Admins keep their role; opening a business must not demote them.
    if (foundUser.role !== Role.Admin) {
      foundUser.role = Role.Business;
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.save(coords);
      await manager.save(newBusiness);
      // The link lives on users.businessId (owning side), so saving the user
      // writes it.
      foundUser.business = newBusiness;
      await manager.save(foundUser);
    });
    // Return the owner without its back-reference: foundUser.business points
    // at newBusiness, which would make the response circular.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { business: _business, ...owner } = foundUser;
    newBusiness.owner = owner as Users;
    return newBusiness;
  }

  async findBusiness(page: {
    limit: number;
    offset: number;
  }): Promise<Business[]> {
    return await this.businessRepo
      .createQueryBuilder('business')
      .select([
        'business.id',
        'business.name',
        'business.description',
        'business.address',
        'business.email',
        'business.phone_number',
        'business.slug',
        'business.timezone',
      ])
      .orderBy('business.name', 'ASC')
      .take(page.limit)
      .skip(page.offset)
      .getMany();
  }

  async getBusinessBySlug(slug: string): Promise<Business | null> {
    return await this.businessRepo
      .createQueryBuilder('business')
      .select([
        'business.id',
        'business.name',
        'business.description',
        'business.address',
        'business.email',
        'business.phone_number',
        'business.slug',
        'business.timezone',
      ])
      .where('business.slug = :slug', { slug })
      .getOne();
  }

  async updateExistingBusiness(
    slug: string,
    updateData: UpdateBusinessDto,
    user: ActiveUserData,
  ): Promise<Business> {
    const business = await this.getBusinessBySlug(slug);
    if (!business) {
      throw new NotFoundException('Wrong slug or business not found');
    }

    if (user.role !== Role.Admin) {
      const foundUser = await this.usersService.findActiveUser(user.sub);
      const ownedBusiness = await this.findByOwnerId(foundUser.id);
      if (!ownedBusiness || ownedBusiness.id !== business.id) {
        throw new ForbiddenException('This is not your business');
      }
    }

    const updatedFields: Partial<Business> = {};

    if (updateData.name && updateData.name !== business.name) {
      updatedFields.name = updateData.name;
      updatedFields.slug = await this.generateUniqueSlug(
        updateData.name,
        business.id,
      );
    }

    if (updateData.description) {
      updatedFields.description = updateData.description;
    }

    if (updateData.email) {
      updatedFields.email = updateData.email;
    }

    if (updateData.phone_number) {
      updatedFields.phone_number = updateData.phone_number;
    }

    let previousLocation: Location | null = null;
    if (updateData.address && updateData.address !== business.address) {
      let resolved: { coords: Location; formattedAddress: string };
      try {
        resolved = await this.getLocationFromAddress(updateData.address);
      } catch (err) {
        // Same as on create: an address we can't resolve is the client's to fix.
        throw new BadRequestException(
          `Could not resolve the given address: ${errorMessage(err)}`,
        );
      }
      previousLocation =
        (
          await this.businessRepo.findOne({
            where: { id: business.id },
            relations: { coords: true },
          })
        )?.coords ?? null;
      updatedFields.address = resolved.formattedAddress;
      updatedFields.coords = resolved.coords;
    }

    const { coords, ...plainFields } = updatedFields;
    const updatedBusiness = this.businessRepo.merge(business, plainFields);
    return this.dataSource.transaction(async (manager) => {
      if (coords) {
        // Assigned by reference after saving: merge()/create() deep-copy
        // nested entities, and a copy would lack the new location's id.
        updatedBusiness.coords = await manager.save(coords);
      }
      const saved = await manager.save(updatedBusiness);
      // The replaced location is referenced by nothing else.
      if (previousLocation) {
        await manager.remove(previousLocation);
      }
      return saved;
    });
  }

  /**
   * Slugs are unique; on collision append the lowest free numeric suffix
   * (`acme`, `acme-2`, `acme-3`, ...).
   */
  private async generateUniqueSlug(
    name: string,
    excludeBusinessId?: string,
  ): Promise<string> {
    const base = slugify(name, { lower: true, strict: true }) || 'business';
    const taken = new Set(
      (
        await this.businessRepo
          .createQueryBuilder('business')
          .select(['business.id', 'business.slug'])
          .where('(business.slug = :base OR business.slug LIKE :pattern)', {
            base,
            pattern: `${base}-%`,
          })
          .getMany()
      )
        .filter((b) => b.id !== excludeBusinessId)
        .map((b) => b.slug),
    );
    if (!taken.has(base)) {
      return base;
    }
    let suffix = 2;
    while (taken.has(`${base}-${suffix}`)) {
      suffix++;
    }
    return `${base}-${suffix}`;
  }

  private async getLocationFromAddress(
    address: string,
  ): Promise<{ coords: Location; formattedAddress: string }> {
    const { lat, lng, formattedAddress } =
      await this.geocodingService.geocode(address);
    const location: Location = new Location();
    location.lat = lat;
    location.lng = lng;
    return { coords: location, formattedAddress };
  }
}
