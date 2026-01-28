import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MarketService } from './market.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { CreateBookingDto } from '../booking/dto/create-booking.dto';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) { }

  @Post()
  create(@Body() createMarketDto: CreateMarketDto) {
    return this.marketService.create(createMarketDto);
  }

  @Post('booking')
  createBooking(@Body() createBookingDto: CreateBookingDto) {
    return this.marketService.createBooking(createBookingDto);
  }

  @Patch('booking/:id/cancel')
  cancelBooking(@Param('id') id: string) {
    return this.marketService.cancelBooking(+id);
  }

  @Get()
  findAll() {
    return this.marketService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.marketService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMarketDto: UpdateMarketDto) {
    return this.marketService.update(+id, updateMarketDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marketService.remove(+id);
  }
}
