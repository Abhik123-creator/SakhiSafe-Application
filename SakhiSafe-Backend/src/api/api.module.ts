import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CareSeekersModule } from '../care-seekers/care-seekers.module';
import { CasesModule } from '../cases/cases.module';
import { HealthModule } from '../health/health.module';
import { ModulesModule } from '../modules/modules.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    RolesModule,
    ModulesModule,
    PermissionsModule,
    OrganizationsModule,
    CareSeekersModule,
    CasesModule,
    AuditModule,
    HealthModule,
  ],
})
export class ApiModule {}
