import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { OrganizationsRepository } from '../repositories/organizations.repository';

@Injectable()
export class OrganizationsService {
  constructor(private readonly organizationsRepository: OrganizationsRepository) {}

  findAll() {
    return this.organizationsRepository.findAll();
  }

  async findById(id: string) {
    const organization = await this.organizationsRepository.findById(id);
    if (!organization) {
      throw new NotFoundException();
    }
    return organization;
  }

  create(dto: CreateOrganizationDto) {
    return this.organizationsRepository.create(dto);
  }

  update(id: string, dto: UpdateOrganizationDto) {
    return this.organizationsRepository.update(id, dto);
  }
}
