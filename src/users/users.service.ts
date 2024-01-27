import { Injectable, NotFoundException } from '@nestjs/common';
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
    const user: Partial<Users> = await this.findOne(id);
    await this.userRepository.update(user, updateUserDto);
    return await this.userRepository.findOneBy({ id });
  }
}
