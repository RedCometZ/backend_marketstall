import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreatePaymentDto } from '../payment/dto/create-payment.dto';
import { PaymentService } from '../payment/payment.service';

@Controller('booking')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly paymentService: PaymentService,
  ) { }

  @Post()
  create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingService.create(createBookingDto);
  }

  @Get()
  findAll() {
    return this.bookingService.findAll();
  }

  @Get(':uesrId')
  findUserBooking(@Param('uesrId') uesrId: string) {
    return this.bookingService.findBookingByUser(+uesrId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookingService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBookingDto: UpdateBookingDto) {
    return this.bookingService.update(+id, updateBookingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bookingService.remove(+id);
  }

  @Patch(':id/cancel')
  cancelBooking(@Param('id') id: string) {
    return this.bookingService.cancelBooking(+id);
  }

  @Post(':id/payment')
  async submitPayment(@Param('id') id: string, @Body() paymentData: any) {
    // Get booking to retrieve user_id and price
    const booking = await this.bookingService.findOne(+id);

    const createPaymentDto: CreatePaymentDto = {
      booking_id: +id,
      user_id: paymentData.user_id,
      price: paymentData.price,
      proof_of_payment: paymentData.proof_of_payment,
      payment_status: paymentData.payment_status || 'pending',
    };

    return this.paymentService.create(createPaymentDto);
  }
}
