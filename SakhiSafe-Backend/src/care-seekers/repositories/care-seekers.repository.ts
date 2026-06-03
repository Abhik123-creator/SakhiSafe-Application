import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    return this.prisma.careSeeker.findFirst({
      where: {
        deletedAt: null,
        OR: [{ phone }, { phone: `+${phone}` }, { phoneNumber: phone }, { whatsappPhoneNumber: phone }],
      },
    });
  }

  findByPhoneNumbers(phoneNumbers: string[]) {
    const uniquePhoneNumbers = [...new Set(phoneNumbers.filter(Boolean))];
    return this.prisma.careSeeker.findFirst({
      where: {
        deletedAt: null,
        OR: uniquePhoneNumbers.flatMap((phone) => [
          { phone },
          { phone: `+${phone}` },
          { phoneNumber: phone },
          { whatsappPhoneNumber: phone },
        ]),
      },
    });
  }

  create(dto: Prisma.CareSeekerCreateInput | CreateCareSeekerDto) {
    return this.prisma.careSeeker.create({ data: dto });
  }

  update(id: string, dto: Prisma.CareSeekerUpdateInput | UpdateCareSeekerDto) {
    return this.prisma.careSeeker.update({ where: { id }, data: dto });
  }
}
