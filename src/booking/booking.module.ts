import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { Market } from '../market/entities/market.entity';
import { PaymentModule } from '../payment/payment.module';

import { Admin } from '../admin/entities/admin.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Market, Admin]), PaymentModule],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule { }
