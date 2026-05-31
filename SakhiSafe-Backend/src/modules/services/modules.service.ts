import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateModuleDto } from '../dto/create-module.dto';
import { UpdateModuleDto } from '../dto/update-module.dto';
import { ModulesRepository } from '../repositories/modules.repository';

@Injectable()
export class ModulesService {
  constructor(private readonly modulesRepository: ModulesRepository) {}

  findAll() {
    return this.modulesRepository.findAll();
  }

  async findById(id: string) {
    const moduleRecord = await this.modulesRepository.findById(id);
    if (!moduleRecord) {
      throw new NotFoundException();
    }
    return moduleRecord;
  }

  create(dto: CreateModuleDto) {
    return this.modulesRepository.create(dto);
  }

  update(id: string, dto: UpdateModuleDto) {
    return this.modulesRepository.update(id, dto);
  }

  toggle(id: string) {
    return this.modulesRepository.toggle(id);
  }

  delete(id: string) {
    return this.modulesRepository.delete(id);
  }
}
