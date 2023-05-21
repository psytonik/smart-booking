import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return await this.userRepository
      .createQueryBuilder('users')
      .select(['users.id', 'users.email', 'users.role', 'users.workplace'])
      .getMany();
  }

  async findOne(id: number): Promise<Partial<User>> {
    const user: User = await this.userRepository.findOneBy({ id });
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

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user: Partial<User> = await this.findOne(id);
    await this.userRepository.update(user, updateUserDto);
    return await this.userRepository.findOneBy({ id });
  }
}
