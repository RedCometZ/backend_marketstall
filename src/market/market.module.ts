import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';

import { TypeOrmModule } from '@nestjs/typeorm';
import { Market } from './entities/market.entity';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Market, Booking, User])],
  controllers: [MarketController],
  providers: [MarketService],
})
export class MarketModule { }
