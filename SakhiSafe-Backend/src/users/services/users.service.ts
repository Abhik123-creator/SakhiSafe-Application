import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoleName } from '@prisma/client';
import { hashPassword } from '../../common/utils/password.util';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly configService: ConfigService,
  ) {}

  findAll() {
    return this.usersRepository.findAll();
  }

  async findById(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException();
    }
    return user;
  }

  findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await hashPassword(dto.password, this.configService.get<number>('auth.bcryptSaltRounds') ?? 10);
    return this.usersRepository.create(
      {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        organization: dto.organizationId ? { connect: { id: dto.organizationId } } : undefined,
      },
      dto.roles ?? [RoleName.ORGANIZATION],
    );
  }

  update(id: string, dto: UpdateUserDto) {
    return this.usersRepository.update(id, {
      email: dto.email,
      fullName: dto.fullName,
      phone: dto.phone,
      organization: dto.organizationId ? { connect: { id: dto.organizationId } } : undefined,
    });
  }

  delete(id: string) {
    return this.usersRepository.softDelete(id);
  }

  toSafeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      name: user.fullName,
      roles: user.roles?.map((userRole) => userRole.role.name) ?? [],
      organizationId: user.organizationId,
    };
  }
}
