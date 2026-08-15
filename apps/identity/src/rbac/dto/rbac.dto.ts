import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'OPERATOR' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Can retry jobs and view executions', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: ['schedules:read', 'jobs:read', 'jobs:retry', 'jobs:cancel'],
    type: [String],
  })
  @IsArray()
  permissions!: string[];
}

export class AssignRoleDto {
  @ApiProperty({ example: 'role-uuid-123' })
  @IsString()
  @IsNotEmpty()
  roleId!: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'operator@acme.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'InitialTempPass123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'OPERATOR', required: false })
  @IsString()
  @IsOptional()
  roleName?: string;
}
