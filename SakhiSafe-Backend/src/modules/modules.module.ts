import { Module } from '@nestjs/common';
import { ModulesController } from './controllers/modules.controller';
import { ModulesRepository } from './repositories/modules.repository';
import { ModulesService } from './services/modules.service';

@Module({
  controllers: [ModulesController],
  providers: [ModulesService, ModulesRepository],
  exports: [ModulesService],
})
export class ModulesModule {}
