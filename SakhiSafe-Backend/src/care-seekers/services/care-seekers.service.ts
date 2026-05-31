import { Injectable, NotFoundException } from '@nestjs/common';
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
    const careSeeker = await this.careSeekersRepository.findByPhone(phone);
    if (!careSeeker) {
      throw new NotFoundException();
    }
    return careSeeker;
  }

  create(dto: CreateCareSeekerDto) {
    return this.careSeekersRepository.create(dto);
  }

  update(id: string, dto: UpdateCareSeekerDto) {
    return this.careSeekersRepository.update(id, dto);
  }
}
