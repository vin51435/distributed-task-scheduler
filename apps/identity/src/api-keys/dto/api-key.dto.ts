import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Production Worker Daemon' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    example: ['schedules:create', 'jobs:create', 'jobs:read'],
    type: [String],
  })
  @IsArray()
  permissions!: string[];

  @ApiProperty({ example: 'pts_live', required: false })
  @IsString()
  @IsOptional()
  prefix?: string;

  @ApiProperty({ example: '2027-01-01T00:00:00.000Z', required: false })
  @IsString()
  @IsOptional()
  expiresAt?: string;
}

export class ValidateApiKeyDto {
  @ApiProperty({ example: 'pts_live_89fae01923...' })
  @IsString()
  @IsNotEmpty()
  rawKey!: string;
}
