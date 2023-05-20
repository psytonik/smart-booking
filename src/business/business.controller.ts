import { Body, Controller, Get, Post } from '@nestjs/common';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { ApiTags } from '@nestjs/swagger';
import { Business } from './entities/business.entity';
import { Auth } from '../iam/authentication/decorator/auth.decorator';
import { AuthType } from '../iam/authentication/enums/auth-type.enum';

@ApiTags('Business')
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

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
}
