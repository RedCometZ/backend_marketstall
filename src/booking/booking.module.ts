import { Module, forwardRef } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { Market } from '../market/entities/market.entity';
import { PaymentModule } from '../payment/payment.module';

import { Admin } from '../admin/entities/admin.entity';
import { Payment } from '../payment/entities/payment.entity';
import { StallMaintenance } from '../market/entities/stall-maintenance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Market, Admin, StallMaintenance, Payment]), forwardRef(() => PaymentModule)],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule { }
