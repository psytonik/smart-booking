import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SignUpDto } from './dto/sign-up.dto.ts';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { Repository } from 'typeorm';
import { HashingService } from '../hashing/hashing.service';
import { SignInDto } from './dto/sign-in.dto.ts';

@Injectable()
export class AuthenticationService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly hashingService: HashingService,
  ) {}
  async signUp(signUpDto: SignUpDto) {
    try {
      const newUser: User = new User();
      newUser.email = signUpDto.email;
      newUser.password = await this.hashingService.hash(signUpDto.password);
      return await this.userRepository.save(newUser);
    } catch (e) {
      const pgUniqueViolationErrorCode = '23505';
      if (e.code === pgUniqueViolationErrorCode) {
        throw new ConflictException(
          `User with this email ${signUpDto.email} already exists`,
        );
      }
      throw e;
    }
  }

  async signIn(signInDto: SignInDto) {
    const user: User = await this.userRepository.findOneBy({
      email: signInDto.email,
    });
    if (!user) {
      throw new UnauthorizedException('User does not exists ');
    }
    const isEqual = await this.hashingService.compare(
      signInDto.password,
      user.password,
    );
    if (!isEqual) {
      throw new UnauthorizedException('Password does not match');
    }
    return true;
  }
}
