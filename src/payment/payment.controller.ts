import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) { }

  @Post()
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentService.create(createPaymentDto);
  }

  @Get('payments')
  findAll() {
    return this.paymentService.findAll();
  }

  @Get('user/:id')
  findByUser(@Param('id') id: string) {
    return this.paymentService.findByUser(+id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return this.paymentService.update(+id, updatePaymentDto);
  }

  @Get('revenue/daily')
  getDailyRevenue(@Query('date') date?: string) {
    return this.paymentService.getDailyRevenue(date);
  }

  @Get('revenue/weekly')
  getWeeklyRevenue(@Query('date') date?: string) {
    return this.paymentService.getWeeklyRevenue(date);
  }

  @Get('revenue/monthly')
  getMonthlyRevenue(@Query('date') date?: string) {
    return this.paymentService.getMonthlyRevenue(date);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentService.remove(+id);
  }
}
