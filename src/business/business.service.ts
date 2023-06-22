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
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';
import slugify from 'slugify';
import {
  Client,
  GeocodeResponse,
  GeocodeResult,
} from '@googlemaps/google-maps-services-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BusinessService {
  private googleMapsClient: Client;

  constructor(
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly configService: ConfigService,
  ) {
    this.googleMapsClient = new Client();
  }
  async openBusiness(
    createBusinessDto: CreateBusinessDto,
    user: ActiveUserData,
  ): Promise<Business> {
    try {
      const foundUser = await this.userRepo.findOneBy({ email: user.email });
      if (!foundUser) {
        throw new NotFoundException('user with this email not found');
      }
      const key = await this.configService.get('GOOGLE_API_KEY');
      const map: GeocodeResult = await this.googleMapsClient
        .geocode({
          params: {
            address: createBusinessDto.address,
            key,
          },
        })
        .then((r: GeocodeResponse) => r.data.results[0]);
      console.log(map, 'map');
      const newBusiness: Business = this.businessRepo.create({
        ...createBusinessDto,
        employees: [],
        slots: [],
        owner: foundUser,
        address: map.formatted_address,
        slug: slugify(createBusinessDto.name, '-').toLowerCase(),
      });
      newBusiness.coords.lat = map.geometry.location.lat;
      newBusiness.coords.lng = map.geometry.location.lng;
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
        'business.phoneNumber',
        'business.slug',
      ])
      .getMany();
  }

  async getBusinessBySlug(slug): Promise<Business> {
    const business = await this.businessRepo
      .createQueryBuilder('business')
      .select([
        'business.id',
        'business.name',
        'business.description',
        'business.address',
        'business.email',
        'business.phoneNumber',
        'business.slug',
      ])
      .where('business.slug = :slug', { slug })
      .getOne();
    try {
      const key = await this.configService.get('GOOGLE_API_KEY');
      const map: GeocodeResult = await this.googleMapsClient
        .geocode({
          params: {
            address: business.address,
            key,
          },
        })
        .then((r: GeocodeResponse) => r.data.results[0]);
      console.log(map.geometry.location, 'map');
    } catch (err) {
      throw new BadRequestException(err.message);
    }

    return business;
  }
}
