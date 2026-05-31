import { Injectable } from '@nestjs/common';
import { CreateRoleDto } from '../dto/create-role.dto';
import { RolesRepository } from '../repositories/roles.repository';

@Injectable()
export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}

  findAll() {
    return this.rolesRepository.findAll();
  }

  create(dto: CreateRoleDto) {
    return this.rolesRepository.create(dto);
  }
}
