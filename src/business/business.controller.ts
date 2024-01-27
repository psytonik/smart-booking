import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Business } from './entities/business.entity';
import { Auth } from '../iam/authentication/decorator/auth.decorator';
import { AuthType } from '../iam/authentication/enums/auth-type.enum';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { UpdateBusinessDto } from './dto/update-business.dto';

@ApiTags('Business')
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @ApiBearerAuth()
  @Post('/open')
  async create(
    @Body() createBusinessDto: CreateBusinessDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    return await this.businessService.openBusiness(createBusinessDto, user);
  }

  @Get()
  @Auth(AuthType.None)
  async findAll(): Promise<Business[]> {
    return this.businessService.findBusiness();
  }

  @ApiResponse({ status: 200, description: 'Business Info' })
  @HttpCode(HttpStatus.OK)
  @Get(':slug')
  @Auth(AuthType.None)
  async getBySlug(@Param('slug') slug: string): Promise<Business> {
    return this.businessService.getBusinessBySlug(slug);
  }

  @ApiResponse({ status: 200, description: 'Business Info' })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(Role.Business, Role.Admin)
  @Patch(':slug')
  async updateBusiness(
    @Param('slug') slug: string,
    @Body() body: UpdateBusinessDto,
  ): Promise<Business> {
    return this.businessService.updateExistingBusiness(slug, body);
  }
}
