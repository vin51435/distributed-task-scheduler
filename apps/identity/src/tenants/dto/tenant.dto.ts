import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TenantPlan, TenantStatus } from '@scheduler/database';

export class UpdateTenantDto {
  @ApiProperty({ example: 'Acme Global Services', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ enum: TenantPlan, required: false })
  @IsEnum(TenantPlan)
  @IsOptional()
  plan?: TenantPlan;

  @ApiProperty({ enum: TenantStatus, required: false })
  @IsEnum(TenantStatus)
  @IsOptional()
  status?: TenantStatus;
}

export class UpdateTenantLimitsDto {
  @ApiProperty({ example: 100, required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxSchedules?: number;

  @ApiProperty({ example: 5000, required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxJobs?: number;

  @ApiProperty({ example: 20, required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxWorkers?: number;

  @ApiProperty({ example: 600, required: false })
  @IsNumber()
  @Min(10)
  @IsOptional()
  maxRequestsPerMinute?: number;
}
