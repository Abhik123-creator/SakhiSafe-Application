import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { isAnonymousName, normalizePhone } from '../../common/utils/phone.util';
import { CreateCareSeekerDto } from '../dto/create-care-seeker.dto';
import { GetOrCreateCareSeekerDto } from '../dto/get-or-create-care-seeker.dto';
import { UpdateCareSeekerDto } from '../dto/update-care-seeker.dto';
import { CareSeekersRepository } from '../repositories/care-seekers.repository';

@Injectable()
export class CareSeekersService {
  private readonly logger = new Logger(CareSeekersService.name);

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

  async getOrCreate(dto: GetOrCreateCareSeekerDto) {
    const phoneNumber = normalizePhone(dto.phoneNumber);
    const whatsappPhoneNumber = normalizePhone(dto.whatsappPhoneNumber);
    if (!phoneNumber && !whatsappPhoneNumber) {
      throw new BadRequestException('phoneNumber or whatsappPhoneNumber is required');
    }

    const existing = await this.careSeekersRepository.findByPhoneNumbers([
      ...(phoneNumber ? [phoneNumber] : []),
      ...(whatsappPhoneNumber ? [whatsappPhoneNumber] : []),
    ]);
    if (existing) {
      this.logger.log(`Reusing care seeker ${existing.id} for internal intake`);
      return existing;
    }

    const displayName = dto.displayName?.trim() || 'WhatsApp Care Seeker';
    this.logger.log('Creating care seeker from internal intake');
    return this.careSeekersRepository.create({
      fullName: displayName,
      displayName,
      phone: phoneNumber ?? whatsappPhoneNumber,
      phoneNumber,
      whatsappPhoneNumber,
      source: dto.source ?? 'WHATSAPP',
      status: 'ACTIVE',
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
