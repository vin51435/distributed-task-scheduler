import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  organizationName!: string;

  @ApiProperty({ example: 'acme', required: false })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongP@ssw0rd2026' })
  @IsString()
  @MinLength(8)
  password!: string;
}
