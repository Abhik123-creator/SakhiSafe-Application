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
        name: dto.name,
        phone: dto.phone,
        organization: dto.organizationId ? { connect: { id: dto.organizationId } } : undefined,
      },
      dto.roles ?? [RoleName.NGO_WORKER],
    );
  }

  update(id: string, dto: UpdateUserDto) {
    return this.usersRepository.update(id, {
      email: dto.email,
      name: dto.name,
      phone: dto.phone,
      organization: dto.organizationId ? { connect: { id: dto.organizationId } } : undefined,
    });
  }

  toSafeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles?.map((userRole) => userRole.role.name) ?? [],
      organizationId: user.organizationId,
    };
  }
}
