import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { SkipResponseTransform } from '../../common/decorators/skip-response-transform.decorator';
import { CreateCaseDto } from '../../cases/dto/create-case.dto';
import { UpdateCaseDto } from '../../cases/dto/update-case.dto';
import { CasesService } from '../../cases/services/cases.service';
import { ServiceJwtGuard } from '../internal-auth/service-jwt.guard';

@ApiTags('Internal Cases')
@ApiBearerAuth('service-jwt')
@SkipResponseTransform()
@UseGuards(ServiceJwtGuard)
@Controller('internal/v1/cases')
export class InternalCasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  @ApiOperation({ summary: 'List cases for service clients' })
  findAll() {
    return this.casesService.findAll();
  }

  @Get('by-phone/:phone')
  @ApiOperation({ summary: 'List cases by care seeker phone number for service clients' })
  @ApiParam({ name: 'phone', example: '917003801171' })
  findByPhone(@Param('phone') phone: string) {
    return this.casesService.findByCareSeekerPhone(phone);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get case by ID for service clients' })
  findOne(@Param('id') id: string) {
    return this.casesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create case from service clients' })
  create(@Body() dto: CreateCaseDto) {
    return this.casesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update case from service clients' })
  update(@Param('id') id: string, @Body() dto: UpdateCaseDto) {
    return this.casesService.update(id, dto);
  }
}
