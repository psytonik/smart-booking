import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateBusinessDto } from './create-business.dto';

export class UpdateBusinessDto extends CreateBusinessDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsOptional()
  readonly name: string;

  @ApiProperty({ type: String })
  @IsString()
  @IsOptional()
  readonly description: string;

  @ApiProperty({ type: String })
  @IsString()
  @IsOptional()
  readonly address: string;

  @ApiProperty({ type: String })
  @IsString()
  @IsOptional()
  readonly email: string;

  @ApiProperty({ type: String })
  @IsString()
  @IsOptional()
  readonly phone_number: string;
}
