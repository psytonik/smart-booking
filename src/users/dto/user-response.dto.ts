import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Role } from '../enums/role.enum.js';

export class UserResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiProperty({ enum: Role })
  @Expose()
  role: Role;

  @ApiPropertyOptional()
  @Expose()
  information?: string;
}
