import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { SlotManagementService } from './slot-management.service';
import { CreateSlotManagementDto } from './dto/create-slot-management.dto';
import { UpdateSlotManagementDto } from './dto/update-slot-management.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Slots Management')
@Controller('slot-management')
export class SlotManagementController {
  constructor(private readonly slotManagementService: SlotManagementService) {}

  @Post()
  create(@Body() createSlotManagementDto: CreateSlotManagementDto) {
    return this.slotManagementService.create(createSlotManagementDto);
  }

  @Get()
  findAll() {
    return this.slotManagementService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.slotManagementService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSlotManagementDto: UpdateSlotManagementDto,
  ) {
    return this.slotManagementService.update(+id, updateSlotManagementDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.slotManagementService.remove(+id);
  }
}
