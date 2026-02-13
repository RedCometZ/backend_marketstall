import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment } from './entities/payment.entity';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';
import { Admin } from '../admin/entities/admin.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
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
      payment_date: createPaymentDto.payment_date ? new Date(createPaymentDto.payment_date) : new Date(),
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Auto-confirm booking (or set to 'pending_review')
    await this.bookingRepository.update(booking_id, { status: 'pending_verification' });

    return savedPayment;
  }

  async findAll() {
    return this.paymentRepository.find({
      relations: ['user', 'booking', 'booking.market', 'admin'],
      order: { payment_date: 'DESC' },
    });
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
    let admin: Admin | null = null;
    if (updatePaymentDto.adminId) {
      admin = await this.adminRepository.findOne({ where: { id: updatePaymentDto.adminId } });
      if (!admin) {
        throw new NotFoundException(`Admin with ID ${updatePaymentDto.adminId} not found`);
      }
    }

    if (updatePaymentDto.payment_status) {
      const payment = await this.findOne(id);
      if (payment && payment.booking) {
        if (updatePaymentDto.payment_status === 'approved') {
          // If payment is approved, booking is fully confirmed -> 'booked'
          await this.bookingRepository.update(payment.booking.id, { status: 'booked' });
        } else if (updatePaymentDto.payment_status === 'rejected') {
          // If payment is rejected, booking is rejected
          await this.bookingRepository.update(payment.booking.id, { status: 'rejected' });
        }
      }
    }

    const { adminId, ...updateData } = updatePaymentDto;
    return this.paymentRepository.save({
      id,
      ...updateData,
      ...(admin ? { admin } : {})
    });
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
