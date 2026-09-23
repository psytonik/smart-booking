import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../iam/authorization/decorators/roles.decorator.js';
import { Role } from '../users/enums/role.enum.js';
import { ActiveUser } from '../iam/decorators/active-user.decorator.js';
import type { ActiveUserData } from '../iam/interface/active-user-data.interface.js';
import { Auth } from '../iam/authentication/decorator/auth.decorator.js';
import { AuthType } from '../iam/authentication/enums/auth-type.enum.js';
import { Serialize } from '../common/serialization/serialize.decorator.js';
import { StaffAccessService } from '../business/staff-access.service.js';
import { BusinessService } from '../business/business.service.js';
import { ServicesService } from './services.service.js';
import {
  CreateServiceDto,
  SetOfferingsDto,
  UpdateServiceDto,
} from './dto/service.dto.js';
import { ServiceResponseDto } from './dto/service-response.dto.js';
import { Service } from './entities/service.entity.js';

/** The owner's service catalog. */
@ApiTags('Services')
@ApiBearerAuth()
@Roles(Role.Business, Role.Employee, Role.Admin)
@Controller('services')
export class ServicesController {
  constructor(
    private readonly services: ServicesService,
    private readonly staffAccess: StaffAccessService,
  ) {}

  @ApiOperation({ summary: 'All services of my business (staff can read)' })
  @Serialize(ServiceResponseDto, { isArray: true })
  @Get()
  async list(@ActiveUser() user: ActiveUserData): Promise<Service[]> {
    const ctx = await this.staffAccess.resolve(user);
    return this.services.listForOwner(ctx.business);
  }

  @ApiOperation({ summary: 'Add a service (owner)' })
  @Serialize(ServiceResponseDto)
  @Post()
  async create(
    @Body() dto: CreateServiceDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<Service> {
    const ctx = await this.staffAccess.resolve(user);
    this.staffAccess.requireOwner(ctx);
    return this.services.create(ctx.business, dto);
  }

  @ApiOperation({ summary: 'Edit a service (owner)' })
  @Serialize(ServiceResponseDto)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<Service> {
    const ctx = await this.staffAccess.resolve(user);
    this.staffAccess.requireOwner(ctx);
    return this.services.update(ctx.business, id, dto);
  }

  @ApiOperation({
    summary:
      'Stop offering a service (owner). Past bookings keep referring to it.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveUser() user: ActiveUserData,
  ): Promise<void> {
    const ctx = await this.staffAccess.resolve(user);
    this.staffAccess.requireOwner(ctx);
    await this.services.deactivate(ctx.business, id);
  }

  @ApiOperation({
    summary: 'Set which staff offer the service, with optional overrides',
  })
  @Serialize(ServiceResponseDto)
  @Put(':id/staff')
  async setOfferings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetOfferingsDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<Service> {
    const ctx = await this.staffAccess.resolve(user);
    this.staffAccess.requireOwner(ctx);
    return this.services.setOfferings(ctx.business, id, dto);
  }
}

/** What clients see on a business page. */
@ApiTags('Services')
@Auth(AuthType.None)
@Controller('business/:slug/services')
export class PublicServicesController {
  constructor(
    private readonly services: ServicesService,
    private readonly businessService: BusinessService,
  ) {}

  @ApiOperation({ summary: 'Bookable services of a business, with prices' })
  @Serialize(ServiceResponseDto, { isArray: true })
  @Get()
  async list(@Param('slug') slug: string): Promise<Service[]> {
    const business = await this.businessService.getBusinessBySlug(slug);
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return this.services.listPublic(business.id);
  }
}
