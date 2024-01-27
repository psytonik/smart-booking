import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Business } from './entities/business.entity';
import { Repository } from 'typeorm';
import { CreateBusinessDto } from './dto/create-business.dto';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { Users } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';
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
    @InjectRepository(Users) private readonly userRepo: Repository<Users>,
    private readonly configService: ConfigService,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
  ) {
    this.googleMapsClient = new Client();
    this.key = this.configService.getOrThrow('GOOGLE_API_KEY');
  }
  async openBusiness(
    createBusinessDto: CreateBusinessDto,
    user: ActiveUserData,
  ): Promise<Business> {
    try {
      const foundUser: Users = await this.userRepo.findOneBy({
        email: user.email,
      });
      const { formattedAddress, coords } = await this.getLocationFromAddress(
        createBusinessDto.address,
      );
      const newBusiness: Business = this.businessRepo.create({
        ...createBusinessDto,
        employees: [],
        slots: [],
        owner: foundUser,
        address: formattedAddress,
        slug: slugify(createBusinessDto.name, '-').toLowerCase(),
        coords: coords,
      });

      await this.businessRepo.save(newBusiness);
      foundUser.business = newBusiness;
      foundUser.role = Role.Business;
      await this.userRepo.save(foundUser);
      return newBusiness;
    } catch (err) {
      throw new BadRequestException(err.message);
    }
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
  ): Promise<Business> {
    const business: Business = await this.getBusinessBySlug(slug);
    if (!business) {
      throw new NotFoundException('Wrong slug or business not found');
    }

    const updatedFields: Partial<Business> = {};

    if (updateData.name) {
      updatedFields.name = updateData.name;
      updatedFields.slug = slugify(updateData.name, '-').toLowerCase();
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
        updatedFields.coords = coords;
      } catch (e) {
        console.error('Error updating address', e);
      }
    }

    const updatedBusiness = this.businessRepo.merge(business, updatedFields);
    return this.businessRepo.save(updatedBusiness);
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

    await this.locationRepo.save(location);

    return {
      coords: location,
      formattedAddress: map.formatted_address,
    };
  }
}
