import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment } from './entities/payment.entity';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';
import { Admin } from '../admin/entities/admin.entity';
import { BookingService } from '../booking/booking.service';


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
    @Inject(forwardRef(() => BookingService))
    private bookingService: BookingService,
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
    await this.bookingService.cleanupExpiredBookings();
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
    await this.bookingService.cleanupExpiredBookings();
    return this.paymentRepository.find({
      where: { user: { id: userId } },
      relations: ['booking', 'booking.market'],
      order: { payment_date: 'DESC' }
    });
  }

  async remove(id: number) {
    return this.paymentRepository.delete(id);
  }

  // Helper to calculate revenue based on accrual basis
  private async calculateRevenueForRange(startDate: Date, endDate: Date) {
    const bookings = await this.bookingRepository.find({
      where: [
        { status: 'booked' },
        { status: 'finished' }
      ]
    });

    let totalRevenue = 0;
    let transactionCount = 0;

    for (const booking of bookings) {
      if (!booking.startDate || !booking.endDate) {
        continue;
      }

      const bookingStart = new Date(booking.startDate);
      const bookingEnd = new Date(booking.endDate);

      bookingStart.setHours(0, 0, 0, 0);
      bookingEnd.setHours(0, 0, 0, 0);

      // console.log(`[Revenue] Checking Booking ID: ${booking.id}, Booking Range: ${bookingStart.toISOString()} - ${bookingEnd.toISOString()}, Query Range: ${startDate.toISOString()} - ${endDate.toISOString()}`);

      if (bookingStart <= endDate && bookingEnd >= startDate) {
        const tempOverlapStart = bookingStart < startDate ? startDate : bookingStart;
        const tempOverlapEnd = bookingEnd > endDate ? endDate : bookingEnd;

        // Strip times safely before calculating days
        const overlapStart = new Date(tempOverlapStart);
        overlapStart.setHours(0, 0, 0, 0);
        const overlapEnd = new Date(tempOverlapEnd);
        overlapEnd.setHours(0, 0, 0, 0);

        const overlapTime = Math.abs(overlapEnd.getTime() - overlapStart.getTime());
        const overlapDays = Math.round(overlapTime / (1000 * 3600 * 24)) + 1;

        const durationTime = Math.abs(bookingEnd.getTime() - bookingStart.getTime());
        const totalDurationDays = Math.round(durationTime / (1000 * 3600 * 24)) + 1;

        console.log(`[Revenue] Booking ID: ${booking.id}, Price: ${booking.price}`);
        console.log(`  - Booking Duration: ${totalDurationDays} days`);
        console.log(`  - Overlap: ${overlapDays} days (${overlapStart.toISOString().split('T')[0]} to ${overlapEnd.toISOString().split('T')[0]})`);

        if (totalDurationDays > 0 && overlapDays > 0) {
          const dailyRate = Number(booking.price) / totalDurationDays;
          const revenueContribution = dailyRate * overlapDays;
          totalRevenue += revenueContribution;
          transactionCount++;
          console.log(`  - Daily Rate: ${dailyRate}, Contribution: ${revenueContribution}`);
        }
      }
    }

    console.log(`[Revenue] Total Revenue: ${totalRevenue}, Count: ${transactionCount}`);

    return {
      totalRevenue: totalRevenue, // Do not round to int, let it match frontend exact decimal
      transactionCount,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }

  async getDailyRevenue(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.calculateRevenueForRange(targetDate, endOfDay);

    return {
      status: 'success',
      data: {
        ...result,
        date: targetDate.toISOString().split('T')[0]
      }
    };
  }



  async getWeeklyRevenue(date?: string) {
    const targetDate = date ? new Date(date) : new Date();

    const day = targetDate.getDay();
    const diff = targetDate.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(targetDate.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const result = await this.calculateRevenueForRange(startOfWeek, endOfWeek);

    return {
      status: 'success',
      data: result
    };
  }

  async getMonthlyRevenue(date?: string) {
    const targetDate = date ? new Date(date) : new Date();

    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const result = await this.calculateRevenueForRange(startOfMonth, endOfMonth);

    return {
      status: 'success',
      data: {
        ...result,
        month: targetDate.getMonth() + 1,
        year: targetDate.getFullYear()
      }
    };
  }
}
