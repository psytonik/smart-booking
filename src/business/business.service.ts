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
import {
  Client,
  GeocodeResponse,
  GeocodeResult,
} from '@googlemaps/google-maps-services-js';
import { ConfigService } from '@nestjs/config';
import { Location } from './entities/location.entity';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Injectable()
export class BusinessService {
  private googleMapsClient: Client;
  private key: string;
  constructor(
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    private readonly dataSource: DataSource,
  ) {
    this.googleMapsClient = new Client();
    this.key = this.configService.getOrThrow('GOOGLE_API_KEY');
  }

  async findById(id: string): Promise<Business | null> {
    return await this.businessRepo.findOneBy({ id });
  }

  async findByOwnerId(userId: number): Promise<Business | null> {
    return await this.businessRepo.findOne({
      where: { owner: { id: userId } },
      relations: ['owner'],
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
        `Could not resolve the given address: ${err.message}`,
      );
    }

    const newBusiness: Business = this.businessRepo.create({
      ...createBusinessDto,
      employees: [],
      slots: [],
      owner: foundUser,
      address: formattedAddress,
      slug: await this.generateUniqueSlug(createBusinessDto.name),
      coords: coords,
    });

    foundUser.business = newBusiness;
    // Admins keep their role; opening a business must not demote them.
    if (foundUser.role !== Role.Admin) {
      foundUser.role = Role.Business;
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.save(coords);
      await manager.save(newBusiness);
      await manager.save(foundUser);
    });
    // businessRepo.create() doesn't keep a reference to foundUser, so
    // newBusiness.owner would otherwise still reflect the pre-update role.
    // Copy the fields directly rather than assigning foundUser itself,
    // since foundUser.business now points back at newBusiness and would
    // create a circular reference the response can't be serialized with.
    newBusiness.owner = { ...newBusiness.owner, role: foundUser.role };
    return newBusiness;
  }

  async findBusiness(): Promise<Business[]> {
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
      ])
      .getMany();
  }

  async getBusinessBySlug(slug: string): Promise<Business> {
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
      ])
      .where('business.slug = :slug', { slug })
      .getOne();
  }

  async updateExistingBusiness(
    slug: string,
    updateData: UpdateBusinessDto,
    user: ActiveUserData,
  ): Promise<Business> {
    const business: Business = await this.getBusinessBySlug(slug);
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

    if (updateData.address && updateData.address !== business.address) {
      try {
        const { coords, formattedAddress } = await this.getLocationFromAddress(
          updateData.address,
        );
        updatedFields.address = formattedAddress;
        updatedFields.coords = await this.locationRepo.save(coords);
      } catch (e) {
        console.error('Error updating address', e);
      }
    }

    const updatedBusiness = this.businessRepo.merge(business, updatedFields);
    return this.businessRepo.save(updatedBusiness);
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
    const map: GeocodeResult = await this.googleMapsClient
      .geocode({
        params: {
          address: address,
          key: this.key,
        },
      })
      .then((r: GeocodeResponse) => r.data.results[0]);

    const location: Location = new Location();
    location.lat = map.geometry.location.lat;
    location.lng = map.geometry.location.lng;

    return {
      coords: location,
      formattedAddress: map.formatted_address,
    };
  }
}
