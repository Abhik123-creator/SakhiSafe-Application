import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RolesRepository } from '../repositories/roles.repository';

@Injectable()
export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}

  findAll() {
    return this.rolesRepository.findAll();
  }

  async findById(id: string) {
    const role = await this.rolesRepository.findById(id);
    if (!role) {
      throw new NotFoundException();
    }
    return role;
  }

  create(dto: CreateRoleDto) {
    return this.rolesRepository.create(dto);
  }

  update(id: string, dto: UpdateRoleDto) {
    return this.rolesRepository.update(id, dto);
  }

  delete(id: string) {
    return this.rolesRepository.delete(id);
  }
}
