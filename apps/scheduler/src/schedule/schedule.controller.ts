import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleResponseDto } from './responses/schedule.response.dto';

@ApiTags('schedules')
@Controller('schedules')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new schedule' })
  @ApiResponse({
    status: 201,
    description: 'Schedule successfully created',
    type: ScheduleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data or validation error' })
  async create(
    @Body() createScheduleDto: CreateScheduleDto,
    @Headers('x-tenant-id') tenantId?: string,
  ): Promise<ScheduleResponseDto> {
    const entity = await this.scheduleService.createSchedule(createScheduleDto, tenantId);
    return ScheduleResponseDto.fromEntity(entity);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Batch create up to 1000 schedules in a single transaction' })
  @ApiResponse({ status: 201, description: 'Schedules created in batch' })
  async createBatch(@Body() dtos: CreateScheduleDto[], @Headers('x-tenant-id') tenantId?: string) {
    const result = await this.scheduleService.createBatchSchedules(dtos, tenantId);
    return {
      created: result.created,
      schedules: result.schedules.map(ScheduleResponseDto.fromEntity),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all schedules' })
  @ApiResponse({ status: 200, description: 'List of all schedules', type: [ScheduleResponseDto] })
  async findAll(@Headers('x-tenant-id') tenantId?: string): Promise<ScheduleResponseDto[]> {
    const entities = await this.scheduleService.getSchedules(tenantId);
    return entities.map(ScheduleResponseDto.fromEntity);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a schedule by ID' })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiResponse({ status: 200, description: 'Schedule found', type: ScheduleResponseDto })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ScheduleResponseDto> {
    const entity = await this.scheduleService.getScheduleById(id);
    return ScheduleResponseDto.fromEntity(entity);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause a schedule' })
  async pause(@Param('id', ParseUUIDPipe) id: string): Promise<ScheduleResponseDto> {
    const entity = await this.scheduleService.pauseSchedule(id);
    return ScheduleResponseDto.fromEntity(entity);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused schedule' })
  async resume(@Param('id', ParseUUIDPipe) id: string): Promise<ScheduleResponseDto> {
    const entity = await this.scheduleService.resumeSchedule(id);
    return ScheduleResponseDto.fromEntity(entity);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing schedule' })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiResponse({
    status: 200,
    description: 'Schedule updated successfully',
    type: ScheduleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ): Promise<ScheduleResponseDto> {
    const entity = await this.scheduleService.updateSchedule(id, updateScheduleDto);
    return ScheduleResponseDto.fromEntity(entity);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a schedule by ID' })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiResponse({ status: 204, description: 'Schedule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.scheduleService.deleteSchedule(id);
  }
}
