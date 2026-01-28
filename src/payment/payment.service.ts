import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment } from './entities/payment.entity';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) { }

  async create(createPaymentDto: CreatePaymentDto) {
    const { user_id, booking_id, ...paymentData } = createPaymentDto;

    const user = await this.userRepository.findOne({ where: { id: user_id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${user_id} not found`);
    }

    const booking = await this.bookingRepository.findOne({ where: { id: booking_id } });
    if (!booking) {
      throw new NotFoundException(`Booking with ID ${booking_id} not found`);
    }

    const payment = this.paymentRepository.create({
      ...paymentData,
      user,
      booking,
      payment_date: new Date(),
    });

    return this.paymentRepository.save(payment);
  }

  async findAll() {
    return this.paymentRepository.find({ relations: ['user', 'booking'] });
  }

  async findOne(id: number) {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['user', 'booking'],
    });
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }
    return payment;
  }

  async update(id: number, updatePaymentDto: UpdatePaymentDto) {
    return this.paymentRepository.update(id, updatePaymentDto);
  }

  async findByUser(userId: number) {
    return this.paymentRepository.find({
      where: { user: { id: userId } },
      relations: ['booking', 'booking.market'],
      order: { payment_date: 'DESC' }
    });
  }

  async remove(id: number) {
    return this.paymentRepository.delete(id);
  }
}
