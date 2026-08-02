import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsDateString } from 'class-validator';
import { ScheduleStatus, ScheduleType } from '../entities/schedule.entity';
import { IsValidCron } from '../validators/cron.validator';
import { IsValidTimezone } from '../validators/timezone.validator';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Schedule name', example: 'Daily Cleanup Job' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Schedule description',
    example: 'Cleans up temporary data daily',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ScheduleType, default: ScheduleType.CRON, description: 'Type of schedule' })
  @IsEnum(ScheduleType)
  type!: ScheduleType;

  @ApiPropertyOptional({
    description: 'Cron expression (required for CRON type)',
    example: '0 0 * * *',
  })
  @IsOptional()
  @IsValidCron()
  cron?: string;

  @ApiPropertyOptional({
    description: 'Execution timestamp (required for ONE_OFF type)',
    example: '2026-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  executeAt?: string;

  @ApiPropertyOptional({ description: 'Timezone identifier', example: 'UTC', default: 'UTC' })
  @IsOptional()
  @IsValidTimezone()
  timezone?: string;

  @ApiProperty({
    description: 'JSON payload passed to the job execution',
    example: { target: 'temp_files' },
  })
  @IsObject()
  payload!: Record<string, any>;

  @ApiPropertyOptional({
    enum: ScheduleStatus,
    default: ScheduleStatus.ACTIVE,
    description: 'Initial status',
  })
  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;
}
