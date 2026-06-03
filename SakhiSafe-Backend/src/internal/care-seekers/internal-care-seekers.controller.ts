import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { SkipResponseTransform } from '../../common/decorators/skip-response-transform.decorator';
import { CreateCareSeekerDto } from '../../care-seekers/dto/create-care-seeker.dto';
import { GetOrCreateCareSeekerDto } from '../../care-seekers/dto/get-or-create-care-seeker.dto';
import { UpdateCareSeekerDto } from '../../care-seekers/dto/update-care-seeker.dto';
import { CareSeekersService } from '../../care-seekers/services/care-seekers.service';
import { ServiceJwtGuard } from '../internal-auth/service-jwt.guard';

@ApiTags('Internal Care Seekers')
@ApiBearerAuth('service-jwt')
@SkipResponseTransform()
@UseGuards(ServiceJwtGuard)
@Controller('internal/v1/care-seekers')
export class InternalCareSeekersController {
  constructor(private readonly careSeekersService: CareSeekersService) {}

  @Get()
  @ApiOperation({ summary: 'List care seekers for service clients' })
  findAll() {
    return this.careSeekersService.findAll();
  }

  @Get('by-phone/:phone')
  @ApiOperation({ summary: 'Get care seeker by phone number for service clients' })
  @ApiParam({ name: 'phone', example: '917003801171' })
  findByPhone(@Param('phone') phone: string) {
    return this.careSeekersService.findByPhone(phone);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get care seeker by ID for service clients' })
  findOne(@Param('id') id: string) {
    return this.careSeekersService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create care seeker from service clients' })
  create(@Body() dto: CreateCareSeekerDto) {
    return this.careSeekersService.create(dto);
  }

  @Post('get-or-create')
  @ApiOperation({ summary: 'Get or create care seeker from service clients' })
  getOrCreate(@Body() dto: GetOrCreateCareSeekerDto) {
    return this.careSeekersService.getOrCreate(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update care seeker from service clients' })
  update(@Param('id') id: string, @Body() dto: UpdateCareSeekerDto) {
    return this.careSeekersService.update(id, dto);
  }
}
