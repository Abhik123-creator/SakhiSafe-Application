import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCareSeekerDto } from '../dto/create-care-seeker.dto';
import { UpdateCareSeekerDto } from '../dto/update-care-seeker.dto';

@Injectable()
export class CareSeekersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.careSeeker.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } });
  }

  findById(id: string) {
    return this.prisma.careSeeker.findFirst({ where: { id, deletedAt: null } });
  }

  findByPhone(phone: string) {
    return this.prisma.careSeeker.findFirst({ where: { phone, deletedAt: null } });
  }

  create(dto: CreateCareSeekerDto) {
    return this.prisma.careSeeker.create({ data: dto });
  }

  update(id: string, dto: UpdateCareSeekerDto) {
    return this.prisma.careSeeker.update({ where: { id }, data: dto });
  }
}
