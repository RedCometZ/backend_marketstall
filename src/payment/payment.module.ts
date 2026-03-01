import { Module, forwardRef } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';
import { Admin } from '../admin/entities/admin.entity';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Booking, User, Admin]), forwardRef(() => BookingModule)],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule { }
