import { IsISO4217CurrencyCode, IsString, IsTimeZone } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBusinessDto {
  @ApiProperty()
  @IsString()
  readonly name: string;

  @ApiProperty()
  @IsString()
  readonly description: string;

  @ApiProperty()
  @IsString()
  readonly address: string;

  @ApiProperty()
  @IsString()
  readonly email: string;

  @ApiProperty()
  @IsString()
  readonly phone_number: string;

  @ApiProperty({
    example: 'Europe/Berlin',
    description:
      'IANA timezone of the business. Working hours and booking times are local to it.',
  })
  @IsTimeZone()
  readonly timezone: string;

  @ApiProperty({
    example: 'EUR',
    description: 'ISO 4217 currency; service prices are in its minor units',
  })
  @IsISO4217CurrencyCode()
  readonly currency: string;
}
