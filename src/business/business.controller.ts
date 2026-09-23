import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Business } from './entities/business.entity';
import { Auth } from '../iam/authentication/decorator/auth.decorator';
import { AuthType } from '../iam/authentication/enums/auth-type.enum';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { Serialize } from '../common/serialization/serialize.decorator';
import {
  BusinessResponseDto,
  OpenedBusinessResponseDto,
} from './dto/business-response.dto';

@ApiTags('Business')
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @ApiBearerAuth()
  @Post('/open')
  @Serialize(OpenedBusinessResponseDto)
  async create(
    @Body() createBusinessDto: CreateBusinessDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    return await this.businessService.openBusiness(createBusinessDto, user);
  }

  @Get()
  @Auth(AuthType.None)
  @Serialize(BusinessResponseDto, { isArray: true })
  async findAll(@Query() page: PaginationQueryDto): Promise<Business[]> {
    return this.businessService.findBusiness(page);
  }

  @Serialize(BusinessResponseDto)
  @HttpCode(HttpStatus.OK)
  @Get(':slug')
  @Auth(AuthType.None)
  async getBySlug(@Param('slug') slug: string): Promise<Business> {
    const business = await this.businessService.getBusinessBySlug(slug);
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return business;
  }

  @Serialize(BusinessResponseDto)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(Role.Business, Role.Admin)
  @Patch(':slug')
  async updateBusiness(
    @Param('slug') slug: string,
    @Body() body: UpdateBusinessDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<Business> {
    return this.businessService.updateExistingBusiness(slug, body, user);
  }
}
