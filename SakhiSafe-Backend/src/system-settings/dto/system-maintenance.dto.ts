import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum SystemMaintenanceAction {
  CLEAR_CACHE = 'CLEAR_CACHE',
  FIX_FILE_PERMISSIONS = 'FIX_FILE_PERMISSIONS',
  BACKUP_DATABASE = 'BACKUP_DATABASE',
}

export class SystemMaintenanceDto {
  @ApiProperty({ enum: SystemMaintenanceAction })
  @IsEnum(SystemMaintenanceAction)
  action: SystemMaintenanceAction;
}
