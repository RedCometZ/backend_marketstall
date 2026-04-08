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

  @Get('all')
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

  @Patch(':id/checkout')
  earlyCheckout(@Param('id') id: string) {
    return this.bookingService.earlyCheckout(+id);
  }

  @Post('cleanup')
  cleanup() {
    return this.bookingService.cleanupExpiredBookings();
  }
}
