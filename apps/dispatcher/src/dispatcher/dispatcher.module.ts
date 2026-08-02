import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobEntity } from '@scheduler/database';
import { DispatcherRepository } from './dispatcher.repository';
import { DispatcherService } from './dispatcher.service';
import { DispatcherController } from './dispatcher.controller';

@Module({
  imports: [TypeOrmModule.forFeature([JobEntity])],
  controllers: [DispatcherController],
  providers: [DispatcherRepository, DispatcherService],
  exports: [DispatcherService, DispatcherRepository],
})
export class DispatcherModule {}
