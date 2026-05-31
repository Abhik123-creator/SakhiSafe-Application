import { PartialType } from '@nestjs/swagger';
import { CreatePersonAtRiskDto } from './create-person-at-risk.dto';

export class UpdatePersonAtRiskDto extends PartialType(CreatePersonAtRiskDto) {}
