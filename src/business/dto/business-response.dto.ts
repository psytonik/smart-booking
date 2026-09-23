import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class LocationResponseDto {
  @ApiProperty()
  @Expose()
  lat: number;

  @ApiProperty()
  @Expose()
  lng: number;
}

export class BusinessResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  slug: string;

  @ApiProperty()
  @Expose()
  description: string;

  @ApiProperty()
  @Expose()
  address: string;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiProperty()
  @Expose()
  phone_number: string;

  @ApiProperty({ example: 'Europe/Berlin' })
  @Expose()
  timezone: string;

  @ApiProperty({ example: 'EUR' })
  @Expose()
  currency: string;

  @ApiPropertyOptional({ type: LocationResponseDto })
  @Expose()
  @Type(() => LocationResponseDto)
  coords?: LocationResponseDto;
}

export class OpenedBusinessResponseDto extends BusinessResponseDto {
  @ApiProperty({ type: UserResponseDto })
  @Expose()
  @Type(() => UserResponseDto)
  owner: UserResponseDto;
}

/** The business fields a client needs alongside a booking. */
export class BusinessSummaryDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  slug: string;

  @ApiProperty()
  @Expose()
  address: string;

  @ApiProperty()
  @Expose()
  timezone: string;

  @ApiProperty()
  @Expose()
  currency: string;
}
