import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Users } from './entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users) private readonly userRepository: Repository<Users>,
  ) {}

  async findAll(): Promise<Users[]> {
    return await this.userRepository
      .createQueryBuilder('users')
      .select(['users.id', 'users.email', 'users.role', 'users.workplace'])
      .getMany();
  }

  /**
   * Resolves the authenticated caller from the JWT `sub` claim. A valid token
   * whose user has since been deleted is treated as unauthenticated.
   */
  async findActiveUser(id: number): Promise<Users> {
    const user = id ? await this.userRepository.findOneBy({ id }) : null;
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return user;
  }

  async findOne(id: number): Promise<Partial<Users>> {
    const user: Users = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`User Not Found`);
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      workplace: user.workplace,
    };
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<Users> {
    await this.findOne(id);
    if (Object.keys(updateUserDto).length > 0) {
      await this.userRepository.update(id, updateUserDto);
    }
    return await this.userRepository.findOneBy({ id });
  }
}
