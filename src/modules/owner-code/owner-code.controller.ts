import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OwnerCodeService } from './owner-code.service';
import { CreateOwnerCodeDto, OwnerCodeResponseDto } from './dto/owner-code.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '../../enums';

@ApiTags('owner-codes')
@Controller('owner-codes')
export class OwnerCodeController {
  constructor(private readonly ownerCodeService: OwnerCodeService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create new owner code (Owner only)' })
  @ApiResponse({
    status: 201,
    description: 'Owner code created successfully',
    type: OwnerCodeResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Owner code already exists' })
  async create(@Body() dto: CreateOwnerCodeDto) {
    return this.ownerCodeService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all owner codes (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Owner codes list',
  })
  async findAll() {
    return this.ownerCodeService.findAll();
  }
}
