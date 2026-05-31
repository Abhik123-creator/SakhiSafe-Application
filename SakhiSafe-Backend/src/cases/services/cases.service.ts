import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { normalizePhone } from '../../common/utils/phone.util';
import { CreateCaseDto } from '../dto/create-case.dto';
import { UpdateCaseDto } from '../dto/update-case.dto';
import { CasesRepository } from '../repositories/cases.repository';

@Injectable()
export class CasesService {
  constructor(private readonly casesRepository: CasesRepository) {}

  findAll() {
    return this.casesRepository.findAll();
  }

  async findById(id: string) {
    const caseRecord = await this.casesRepository.findById(id);
    if (!caseRecord) {
      throw new NotFoundException();
    }
    return caseRecord;
  }

  findByCareSeekerPhone(phone: string) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      throw new BadRequestException('Phone number is required');
    }

    return this.casesRepository.findByCareSeekerPhone(normalizedPhone);
  }

  async create(dto: CreateCaseDto, createdById?: string) {
    await this.ensureCareSeekerExists(dto.careSeekerId);

    return this.casesRepository.create({
      title: dto.title,
      summary: dto.summary,
      notes: dto.notes,
      incidentDescription: dto.incidentDescription,
      status: dto.status,
      riskLevel: dto.riskLevel,
      careSeeker: { connect: { id: dto.careSeekerId } },
      organization: dto.organizationId ? { connect: { id: dto.organizationId } } : undefined,
      assignedTo: dto.assignedToId ? { connect: { id: dto.assignedToId } } : undefined,
      createdBy: createdById ? { connect: { id: createdById } } : undefined,
    });
  }

  async update(id: string, dto: UpdateCaseDto) {
    await this.findById(id);
    if (dto.careSeekerId) {
      await this.ensureCareSeekerExists(dto.careSeekerId);
    }

    return this.casesRepository.update(id, {
      title: dto.title,
      summary: dto.summary,
      notes: dto.notes,
      incidentDescription: dto.incidentDescription,
      status: dto.status,
      riskLevel: dto.riskLevel,
      careSeeker: dto.careSeekerId ? { connect: { id: dto.careSeekerId } } : undefined,
      organization: dto.organizationId ? { connect: { id: dto.organizationId } } : undefined,
      assignedTo: dto.assignedToId ? { connect: { id: dto.assignedToId } } : undefined,
    });
  }

  private async ensureCareSeekerExists(careSeekerId: string) {
    const careSeeker = await this.casesRepository.careSeekerExists(careSeekerId);
    if (!careSeeker) {
      throw new BadRequestException(`Care seeker ${careSeekerId} does not exist`);
    }
  }
}
