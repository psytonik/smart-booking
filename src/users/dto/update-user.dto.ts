import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Free-form notes about the user' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  readonly information?: string;
}
