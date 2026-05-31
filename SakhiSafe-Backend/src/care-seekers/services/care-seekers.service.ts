import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isAnonymousName, normalizePhone } from '../../common/utils/phone.util';
import { CreateCareSeekerDto } from '../dto/create-care-seeker.dto';
import { UpdateCareSeekerDto } from '../dto/update-care-seeker.dto';
import { CareSeekersRepository } from '../repositories/care-seekers.repository';

@Injectable()
export class CareSeekersService {
  constructor(private readonly careSeekersRepository: CareSeekersRepository) {}

  findAll() {
    return this.careSeekersRepository.findAll();
  }

  async findById(id: string) {
    const careSeeker = await this.careSeekersRepository.findById(id);
    if (!careSeeker) {
      throw new NotFoundException();
    }
    return careSeeker;
  }

  async findByPhone(phone: string) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      throw new BadRequestException('Phone number is required');
    }

    const careSeeker = await this.careSeekersRepository.findByPhone(normalizedPhone);
    if (!careSeeker) {
      throw new NotFoundException(`Care seeker not found for phone ${normalizedPhone}`);
    }
    return careSeeker;
  }

  async create(dto: CreateCareSeekerDto) {
    const normalizedPhone = normalizePhone(dto.phone);
    if (normalizedPhone) {
      const existing = await this.careSeekersRepository.findByPhone(normalizedPhone);
      if (existing) {
        return existing;
      }
    }

    return this.careSeekersRepository.create({
      ...dto,
      phone: normalizedPhone,
    });
  }

  async update(id: string, dto: UpdateCareSeekerDto) {
    const existing = await this.findById(id);
    const normalizedPhone = normalizePhone(dto.phone);
    const shouldKeepExistingName = !isAnonymousName(existing.fullName) && isAnonymousName(dto.fullName);

    return this.careSeekersRepository.update(id, {
      ...dto,
      fullName: shouldKeepExistingName ? undefined : dto.fullName,
      phone: dto.phone === undefined ? undefined : normalizedPhone,
    });
  }
}
