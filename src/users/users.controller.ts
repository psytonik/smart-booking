import { Controller, Get, Body, Patch, Param, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from './enums/role.enum.js';
import { Roles } from '../iam/authorization/decorators/roles.decorator.js';
import { Serialize } from '../common/serialization/serialize.decorator.js';
import { UserResponseDto } from './dto/user-response.dto.js';

@ApiTags('Users')
@Roles(Role.Admin)
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Serialize(UserResponseDto, { isArray: true })
  findAll(@Query() page: PaginationQueryDto) {
    return this.usersService.findAll(page);
  }

  @Get(':id')
  @Serialize(UserResponseDto)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  @Serialize(UserResponseDto)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }
}
