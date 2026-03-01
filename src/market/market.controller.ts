import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe
} from '@nestjs/common';
import { MarketService } from './market.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { UpdateMarketDto } from './dto/update-market.dto';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) { }

  // ---------- BASIC ----------
  @Get()
  findAll() {
    return this.marketService.findAll();
  }

  @Get('status')
  findStatuses(
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.marketService.findMarketStatuses(date, startDate, endDate);
  }

  @Get('available')
  findAvailable(
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.marketService.findAvailableMarkets(date, startDate, endDate);
  }

  // ---------- SINGLE ----------
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.marketService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMarketDto,
  ) {
    return this.marketService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.marketService.remove(id);
  }

  // ---------- MAINTENANCE ----------
  @Post(':id/maintenance')
  createMaintenance(
    @Param('id', ParseIntPipe) id: number,
    @Body('startDate') startDate: string,
    @Body('endDate') endDate: string,
  ) {
    return this.marketService.createMaintenance(id, startDate, endDate);
  }

  @Delete(':id/maintenance')
  clearMaintenance(@Param('id', ParseIntPipe) id: number) {
    return this.marketService.clearMaintenance(id);
  }

  @Get(':id/maintenance')
  getMaintenance(@Param('id', ParseIntPipe) id: number) {
    return this.marketService.getMaintenance(id);
  }
}
