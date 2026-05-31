import { Injectable } from '@nestjs/common';
import { Prisma, RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const userInclude = { roles: { include: { role: true } }, organization: true };

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({ where: { deletedAt: null }, include: userInclude });
  }

  findById(id: string) {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null }, include: userInclude });
  }

  findByEmail(email: string) {
    return this.prisma.user.findFirst({ where: { email, deletedAt: null }, include: userInclude });
  }

  async create(data: Prisma.UserCreateInput, roles: RoleName[] = []) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data });
      for (const roleName of roles) {
        const role = await tx.role.upsert({
          where: { name: roleName },
          create: { name: roleName },
          update: {},
        });
        await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
      }
      return tx.user.findUnique({ where: { id: user.id }, include: userInclude });
    });
  }

  update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({ where: { id }, data, include: userInclude });
  }

  softDelete(id: string) {
    return this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false }, include: userInclude });
  }
}
