import { Injectable } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { Booking } from './entities/booking.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual, MoreThanOrEqual, LessThan } from 'typeorm';
import { Market } from '../market/entities/market.entity';
import { Admin } from '../admin/entities/admin.entity';
import { StallMaintenance } from '../market/entities/stall-maintenance.entity';
import { Payment } from '../payment/entities/payment.entity';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Market)
    private _market: Repository<Market>,
    @InjectRepository(Booking)
    private _booking: Repository<Booking>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    @InjectRepository(StallMaintenance)
    private maintenanceRepository: Repository<StallMaintenance>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
  ) { }


  async create(createBookingDto: CreateBookingDto) {
    try {
      const { marketId, userId, startDate, endDate, adminId, status } = createBookingDto;

      // 1. แปลงวันที่
      const start = new Date(startDate);
      const end = new Date(endDate);

      // 2. คำนวณจำนวนวัน (รวมวันแรก)
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      if (diffDays <= 0) {
        throw new Error('Invalid booking date range');
      }

      if (diffDays > 7) {
        throw new Error('สามารถจองได้สูงสุดต่อเนื่องไม่เกิน 7 วัน');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkStart = new Date(start);
      checkStart.setHours(0, 0, 0, 0);

      const advanceDiffTime = checkStart.getTime() - today.getTime();
      const advanceDays = Math.round(advanceDiffTime / (1000 * 60 * 60 * 24));

      if (advanceDays > 14) {
        throw new Error('สามารถจองล่วงหน้าได้สูงสุดไม่เกิน 14 วัน');
      }

      if (advanceDays < 0) {
        throw new Error('ไม่สามารถจองย้อนหลังได้');
      }

      // 3. ดึงข้อมูล market
      const market = await this._market.findOne({
        where: { id: marketId },
      });

      if (!market) {
        throw new Error('Market not found');
      }

      // Check admin
      let admin: Admin | null = null;
      if (adminId) {
        admin = await this.adminRepository.findOne({ where: { id: adminId } });
        if (!admin) {
          throw new Error('Admin not found');
        }
      }

      // 4. คำนวณราคาจริง (Total Price for "Pay All at Once")
      const totalPrice = market.price * diffDays;
      console.log('DEBUG PRICE CALC:', { marketPrice: market.price, diffDays, totalPrice });

      // 5. สร้าง booking entity
      const booking = this._booking.create({
        user: { id: userId },
        market: { id: marketId },
        startDate: start,  // Use the Date object created above
        endDate: end,      // Use the Date object created above
        price: totalPrice,
        status: status || 'booked',
        ...(admin ? { admin } : {})
      });

      // 🔴 เช็คว่ามี maintenance หรือไม่
      const maintenanceOverlap = await this.maintenanceRepository.findOne({
        where: {
          stall: { id: marketId },
          status: 'ACTIVE',
          startDate: LessThanOrEqual(end.toISOString().split('T')[0]),
          endDate: MoreThanOrEqual(start.toISOString().split('T')[0]),
        }
      });

      if (maintenanceOverlap) {
        throw new Error('แผงนี้ปิดปรับปรุงในช่วงวันที่เลือก');
      }

      // 🔴 เช็คว่ามี booking ซ้อนหรือไม่
      const conflict = await this._booking.findOne({
        where: {
          market: { id: marketId },
          status: In(['pending', 'booked', 'pending_verification']),
          startDate: LessThanOrEqual(end),
          endDate: MoreThanOrEqual(start),
        },
      });

      if (conflict) {
        throw new Error('แผงนี้ถูกจองในช่วงวันที่เลือกแล้ว');
      }

      // 6. Save ลง DB
      const savedBooking = await this._booking.save(booking);

      return {
        status: 'success',
        data: savedBooking,
      };

    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }


  async findAll(date?: string) {
    console.log("🚀 ~ BookingService ~ findAll ~ findAll:", date)
    try {
      const whereCondition = date ? { startDate: new Date(date) } : {};

      const bookings = await this._booking.find({
        where: whereCondition,
        relations: {
          market: true,
          user: true,
          payment: true,
          admin: true,
        }
      });

      // Auto-finish: update DB status for booked bookings whose endDate has passed
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const expiredBookings = bookings.filter(booking => {
        if (booking.status === 'booked' && booking.endDate) {
          const end = new Date(booking.endDate);
          end.setHours(23, 59, 59, 999);
          return end < now;
        }
        return false;
      });

      if (expiredBookings.length > 0) {
        const expiredIds = expiredBookings.map(b => b.id);
        await this._booking.update(expiredIds, { status: 'finished' });
        // Update local objects to reflect the change
        expiredBookings.forEach(b => b.status = 'finished');
      }

      return {
        status: 'success',
        data: bookings,
      }

    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      }
    }
  }

  async findBookingByUser(userId: number) {
    try {
      const bookings = await this._booking.find({
        where: { user: { id: userId } },
        relations: {
          market: true,
          payment: true,
        }
      })

      // Auto-finish: update DB status for booked bookings whose endDate has passed
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const expiredBookings = bookings.filter(booking => {
        if (booking.status === 'booked' && booking.endDate) {
          const end = new Date(booking.endDate);
          end.setHours(23, 59, 59, 999);
          return end < now;
        }
        return false;
      });

      if (expiredBookings.length > 0) {
        const expiredIds = expiredBookings.map(b => b.id);
        await this._booking.update(expiredIds, { status: 'finished' });
        expiredBookings.forEach(b => b.status = 'finished');
      }

      return {
        status: 'success',
        data: bookings,
      }
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      }
    }
  }

  async findOne(id: number) {
    try {
      const booking = await this._booking.findOne({
        where: { id },
        relations: {
          market: true,
          user: true,
          payment: true,
        }
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      return booking;
    } catch (error) {
      throw error;
    }
  }

  async update(id: number, updateBookingDto: UpdateBookingDto) {
    const update_booking = await this._booking.update(id, updateBookingDto);
    console.log("🚀 ~ BookingService ~ update ~ update_booking:", update_booking)
    return update_booking;
  }

  async remove(id: number) {
    const remove_booking = await this._booking.delete(id);
    console.log("🚀 ~ BookingService ~ remove ~ remove_booking:", remove_booking)
    return remove_booking;
  }

  async cancelBooking(id: number) {
    const cancel_booking = await this._booking.update(id, { status: 'cancelled' });
    console.log("🚀 ~ BookingService ~ cancelBooking ~ cancel_booking:", cancel_booking)
    return cancel_booking;
  }

  async cleanupExpiredBookings() {
    // 1. Auto-cancel pending bookings older than 1 minute
    const expiredDate = new Date(Date.now() - 1 * 60 * 1000); // 1 minute ago

    const expiredBookings = await this._booking.find({
      where: {
        status: 'pending',
        createdAt: LessThan(expiredDate),
      },
      relations: { payment: true }
    });

    for (const booking of expiredBookings) {
      if (booking.payment && booking.payment.payment_status === 'pending') {
        await this.paymentRepository.update(booking.payment.id, { payment_status: 'rejected' });
      }
    }

    const expiredResult = await this._booking.update({
      status: 'pending',
      createdAt: LessThan(expiredDate),
    }, {
      status: 'cancelled'
    });

    // 2. Auto-cancel unconfirmed bookings past their end date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pastDueBookings = await this._booking.find({
      where: {
        status: In(['pending', 'pending_verification']),
        startDate: LessThan(today),
      },
      relations: { payment: true }
    });

    for (const booking of pastDueBookings) {
      if (booking.payment && booking.payment.payment_status === 'pending') {
        await this.paymentRepository.update(booking.payment.id, { payment_status: 'rejected' });
      }
    }

    const pastDueResult = await this._booking.update({
      status: In(['pending', 'pending_verification']),
      startDate: LessThan(today),
    }, {
      status: 'cancelled'
    });

    // 3. Auto-expire maintenance records
    const todayStr = new Date().toISOString().split('T')[0];

    const expiredMaintenance = await this.maintenanceRepository.find({
      where: {
        status: 'ACTIVE',
        endDate: LessThan(todayStr),
      },
      relations: ['stall']
    });

    if (expiredMaintenance.length > 0) {
      // Update status to COMPLETED (Natural expiration)
      await this.maintenanceRepository.update(
        { id: In(expiredMaintenance.map(m => m.id)) },
        { status: 'COMPLETED' }
      );

      const batchExpired = expiredMaintenance.find(m => m.isBatch);
      if (batchExpired) {
        // Reset ALL markets (Batch overrides everything)
        await this._market.update(
          { status: 'maintenance' },
          { status: 'available', maintenanceStartDate: null as any, maintenanceEndDate: null as any }
        );
      } else {
        // Reset specific stalls
        const stallIds = expiredMaintenance
          .filter(m => m.stall)
          .map(m => m.stall!.id);

        if (stallIds.length > 0) {
          await this._market.update(
            { id: In(stallIds), status: 'maintenance' },
            { status: 'available', maintenanceStartDate: null as any, maintenanceEndDate: null as any }
          );
        }
      }
    }

    const expiredCount = expiredResult.affected || 0;
    const pastDueCount = pastDueResult.affected || 0;
    const completedMaintenanceCount = expiredMaintenance.length;
    const totalAffected = expiredCount + pastDueCount + completedMaintenanceCount;

    if (totalAffected > 0) {
      console.log(`trash Cleanup: Cancelled ${expiredCount} expired pending, ${pastDueCount} past due bookings, ${completedMaintenanceCount} completed maintenance.`);
      return totalAffected;
    }
    return 0;
  }

}
