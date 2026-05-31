import { Injectable } from '@nestjs/common';
import { UpdateRolePermissionsDto } from '../dto/update-role-permissions.dto';
import { PermissionsRepository } from '../repositories/permissions.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  findByRole(roleId: string) {
    return this.permissionsRepository.findByRole(roleId);
  }

  updateRolePermissions(roleId: string, dto: UpdateRolePermissionsDto) {
    return this.permissionsRepository.replaceRolePermissions(roleId, dto.permissions);
  }
}
