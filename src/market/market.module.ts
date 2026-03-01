import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { BookingModule } from '../booking/booking.module';
import { MarketController } from './market.controller';

import { TypeOrmModule } from '@nestjs/typeorm';
import { Market } from './entities/market.entity';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';

import { Payment } from '../payment/entities/payment.entity';
import { StallMaintenance } from './entities/stall-maintenance.entity';
import { MaintenanceController } from './maintenance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Market, Booking, User, Payment, StallMaintenance]), BookingModule],
  controllers: [MarketController, MaintenanceController],
  providers: [MarketService],
})
export class MarketModule { }
