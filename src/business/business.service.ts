import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Business } from './entities/business.entity';
import { Repository } from 'typeorm';
import { CreateBusinessDto } from './dto/create-business.dto';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}
  async openBusiness(
    createBusinessDto: CreateBusinessDto,
    user: ActiveUserData,
  ): Promise<Business> {
    const foundUser = await this.userRepo.findOneBy({ email: user.email });
    if (!foundUser) {
      throw new NotFoundException('user with this email not found');
    }
    const newBusiness: Business = this.businessRepo.create({
      ...createBusinessDto,
      employees: [],
      slots: [],
      owner: foundUser,
    });
    await this.businessRepo.save(newBusiness);
    foundUser.business = newBusiness;
    foundUser.role = Role.Business;
    await this.userRepo.save(foundUser);
    return newBusiness;
  }

  async findBusiness(): Promise<Business[]> {
    return await this.businessRepo.find();
  }
}