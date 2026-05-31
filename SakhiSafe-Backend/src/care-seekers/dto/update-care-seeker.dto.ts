import { PartialType } from '@nestjs/swagger';
import { CreateCareSeekerDto } from './create-care-seeker.dto';

export class UpdateCareSeekerDto extends PartialType(CreateCareSeekerDto) {}
