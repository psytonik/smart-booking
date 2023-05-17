import { Injectable } from '@nestjs/common';
import { CreateSlotManagementDto } from './dto/create-slot-management.dto';
import { UpdateSlotManagementDto } from './dto/update-slot-management.dto';

@Injectable()
export class SlotManagementService {
  create(createSlotManagementDto: CreateSlotManagementDto) {
    return 'This action adds a new slotManagement';
  }

  findAll() {
    return `This action returns all slotManagement`;
  }

  findOne(id: number) {
    return `This action returns a #${id} slotManagement`;
  }

  update(id: number, updateSlotManagementDto: UpdateSlotManagementDto) {
    return `This action updates a #${id} slotManagement`;
  }

  remove(id: number) {
    return `This action removes a #${id} slotManagement`;
  }
}
