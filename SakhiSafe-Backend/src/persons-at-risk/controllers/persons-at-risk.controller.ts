import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction, RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditActionMeta } from '../../common/interceptors/audit-log.interceptor';
import { CreatePersonAtRiskDto } from '../dto/create-person-at-risk.dto';
import { UpdatePersonAtRiskDto } from '../dto/update-person-at-risk.dto';
import { PersonsAtRiskService } from '../services/persons-at-risk.service';

@ApiTags('persons-at-risk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('persons-at-risk')
export class PersonsAtRiskController {
  constructor(private readonly personsAtRiskService: PersonsAtRiskService) {}

  @Get()
  findAll() {
    return this.personsAtRiskService.findAll();
  }

  @Get(':id')
  @AuditActionMeta(AuditAction.PERSON_AT_RISK_VIEWED)
  findOne(@Param('id') id: string) {
    return this.personsAtRiskService.findById(id);
  }

  @Post()
  @Roles(RoleName.SUPER_ADMIN, RoleName.SYSTEM_ADMIN, RoleName.NGO_ADMIN, RoleName.NGO_WORKER)
  create(@Body() dto: CreatePersonAtRiskDto) {
    return this.personsAtRiskService.create(dto);
  }

  @Patch(':id')
  @Roles(RoleName.SUPER_ADMIN, RoleName.SYSTEM_ADMIN, RoleName.NGO_ADMIN, RoleName.NGO_WORKER)
  @AuditActionMeta(AuditAction.PERSON_AT_RISK_UPDATED)
  update(@Param('id') id: string, @Body() dto: UpdatePersonAtRiskDto) {
    return this.personsAtRiskService.update(id, dto);
  }
}
