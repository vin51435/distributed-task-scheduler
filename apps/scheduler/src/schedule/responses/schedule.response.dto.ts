import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduleEntity, ScheduleStatus, ScheduleType } from '../entities/schedule.entity';

export class ScheduleResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'Daily Cleanup Job' })
  name!: string;

  @ApiPropertyOptional({ example: 'Cleans up temporary data daily' })
  description?: string;

  @ApiProperty({ enum: ScheduleType, example: ScheduleType.CRON })
  type!: ScheduleType;

  @ApiPropertyOptional({ example: '0 0 * * *' })
  cron?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  executeAt?: Date;

  @ApiProperty({ example: 'UTC' })
  timezone!: string;

  @ApiProperty({ example: { target: 'temp_files' } })
  payload!: Record<string, any>;

  @ApiProperty({ enum: ScheduleStatus, example: ScheduleStatus.ACTIVE })
  status!: ScheduleStatus;

  @ApiProperty({ example: '2026-08-02T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-02T12:00:00.000Z' })
  updatedAt!: Date;

  static fromEntity(entity: ScheduleEntity): ScheduleResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      type: entity.type,
      cron: entity.cron,
      executeAt: entity.executeAt,
      timezone: entity.timezone ?? 'UTC',
      payload: entity.payload,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
