import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePersonAtRiskDto } from '../dto/create-person-at-risk.dto';
import { UpdatePersonAtRiskDto } from '../dto/update-person-at-risk.dto';
import { PersonsAtRiskRepository } from '../repositories/persons-at-risk.repository';

@Injectable()
export class PersonsAtRiskService {
  constructor(private readonly personsAtRiskRepository: PersonsAtRiskRepository) {}

  findAll() {
    return this.personsAtRiskRepository.findAll();
  }

  async findById(id: string) {
    const person = await this.personsAtRiskRepository.findById(id);
    if (!person) {
      throw new NotFoundException();
    }
    return person;
  }

  create(dto: CreatePersonAtRiskDto) {
    return this.personsAtRiskRepository.create(dto);
  }

  update(id: string, dto: UpdatePersonAtRiskDto) {
    return this.personsAtRiskRepository.update(id, dto);
  }
}
