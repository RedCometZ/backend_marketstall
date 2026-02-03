import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, In } from 'typeorm';
import { CreateMarketDto } from './dto/create-market.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { CreateBookingDto } from '../booking/dto/create-booking.dto';
import { Market } from './entities/market.entity';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class MarketService {
  constructor(
    @InjectRepository(Market)
    private marketRepository: Repository<Market>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
  ) { }

  create(createMarketDto: CreateMarketDto) {
    return this.marketRepository.save(createMarketDto);
  }

  async createBooking(createBookingDto: CreateBookingDto) {
    try {
      await this.cleanupExpiredBookings();

      // 1. Check for overlapping bookings (Double Booking Prevention)
      const conflictingBooking = await this.bookingRepository.createQueryBuilder('booking')
        .where('booking.marketId = :marketId', { marketId: createBookingDto.marketId })
        .andWhere(
          `(booking.status IN (:...statuses))`,
          { statuses: ['booked', 'pending_verification', 'pending'] }
        )
        .andWhere('booking.startDate <= :end', { end: createBookingDto.endDate })
        .andWhere('booking.endDate >= :start', { start: createBookingDto.startDate })
        .getOne();

      if (conflictingBooking) {
        return {
          status: 'error booking',
          message: 'Stall is already booked for the selected dates.',
        }
      }

      const market = await this.marketRepository.findOne({
        where: {
          id: createBookingDto.marketId,
        },
      });

      if (!market) {
        return {
          status: 'error market',
          message: 'Market not found',
        }
      }

      const user = await this.userRepository.findOne({
        where: {
          id: createBookingDto.userId,
        },
      });

      if (!user) {
        return {
          status: 'error user',
          message: 'User not found',
        }
      }

      const start = new Date(createBookingDto.startDate);
      const end = new Date(createBookingDto.endDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const totalPrice = market.price * (diffDays > 0 ? diffDays : 1);

      const bookingData = {
        market,
        user,
        startDate: createBookingDto.startDate,
        endDate: createBookingDto.endDate,
        status: 'pending',
        price: totalPrice,
      };

      const booking = this.bookingRepository.create(bookingData);
      const savedBooking = await this.bookingRepository.save(booking);

      return {
        status: 'success',
        data: savedBooking,
      };

    } catch (error) {
      console.log("🚀 ~ MarketService ~ createBooking ~ error:", error)
      return {
        status: 'error',
        message: error.message,
      }

    }
  }



  async findAll() {
    console.log("🚀 ~ MarketService ~ findAll ~ findAll:")
    try {
      const deletedCount = await this.cleanupExpiredBookings();

      const markets = await this.marketRepository.find({
        // relations: {
        //   bookings: true,
        // }
      });
      return {
        status: 'success',
        data: markets,
        meta: {
          deletedCount
        }
      }

    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      }
    }

  }

  async findAvailableMarkets(date?: string, startDate?: string, endDate?: string) {
    try {
      const deletedCount = await this.cleanupExpiredBookings();

      let queryStartDate: Date;
      let queryEndDate: Date;

      // กำหนดช่วงวันที่ตามพารามิเตอร์ที่ส่งมา
      if (date) {
        // กรณีค้นหาแค่วันเดียว: ?date=2026-05-28
        queryStartDate = new Date(date);
        queryEndDate = new Date(date);
        console.log('🔍 Single date query:', date);
      } else if (startDate && endDate) {
        // กรณีค้นหาช่วงวันที่: ?startDate=2026-02-01&endDate=2026-02-05
        queryStartDate = new Date(startDate);
        queryEndDate = new Date(endDate);
        console.log('🔍 Date range query:', { startDate, endDate });
      } else {
        throw new Error('กรุณาระบุวันที่ (date) หรือช่วงวันที่ (startDate และ endDate)');
      }

      console.log('🔍 Checking availability:', {
        start: queryStartDate.toISOString().split('T')[0],
        end: queryEndDate.toISOString().split('T')[0]
      });

      // ดึงแผงทั้งหมดที่มีสถานะ 'available' หรือ 'Available'
      const allMarkets = await this.marketRepository.find({
        where: [
          { status: 'available' },
          { status: 'Available' }
        ]
      });

      console.log('📊 Total markets with status available:', allMarkets.length);

      // ดึงการจองทั้งหมดที่ทับซ้อนกับช่วงวันที่ที่ต้องการ
      const bookings = await this.bookingRepository
        .createQueryBuilder('booking')
        .leftJoinAndSelect('booking.market', 'market')
        .where('booking.status IN (:...statuses)', { statuses: ['pending', 'booked', 'pending_verification'] })
        .andWhere('booking.startDate <= :end', { end: queryEndDate.toISOString().split('T')[0] })
        .andWhere('booking.endDate >= :start', { start: queryStartDate.toISOString().split('T')[0] })
        .getMany();

      console.log('📋 Found bookings:', bookings.length);
      console.log('📋 Booking details:', bookings.map(b => ({
        id: b.id,
        marketId: b.market?.id,
        marketCode: b.market?.code,
        startDate: b.startDate,
        endDate: b.endDate,
        status: b.status
      })));

      // สร้าง Set ของ market IDs ที่ถูกจองแล้ว
      const bookedMarketIds = new Set(bookings.map(b => b.market?.id).filter(id => id));

      console.log('🔴 Booked market IDs:', Array.from(bookedMarketIds));

      // กรองแผงที่ว่าง (ต้องมี status = available และไม่ถูกจอง)
      const availableMarkets = allMarkets.filter(market => !bookedMarketIds.has(market.id));

      console.log('✅ Available markets:', availableMarkets.length);

      // นับแผงทั้งหมด (รวมทุก status)
      const totalMarkets = await this.marketRepository.count();

      return {
        status: 'success',
        data: availableMarkets,
        meta: {
          startDate: queryStartDate.toISOString().split('T')[0],
          endDate: queryEndDate.toISOString().split('T')[0],
          total: totalMarkets,
          available: availableMarkets.length,
          booked: bookedMarketIds.size,
          deletedCount
        }
      };

    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }

  async findMarketStatuses(date?: string, startDate?: string, endDate?: string) {
    try {
      const deletedCount = await this.cleanupExpiredBookings();

      let queryStartDate: Date;
      let queryEndDate: Date;

      if (date) {
        queryStartDate = new Date(date);
        queryEndDate = new Date(date);
      } else if (startDate && endDate) {
        queryStartDate = new Date(startDate);
        queryEndDate = new Date(endDate);
      } else {
        throw new Error('กรุณาระบุวันที่ (date) หรือช่วงวันที่ (startDate และ endDate)');
      }

      // 1. ดึง Market ทั้งหมดออกมา
      const allMarkets = await this.marketRepository.find();

      const endStr = queryEndDate.toISOString().split('T')[0];
      const startStr = queryStartDate.toISOString().split('T')[0];

      // ดึงการจองทั้งหมดที่ทับซ้อนกับช่วงวันที่ที่ต้องการ
      const bookings = await this.bookingRepository
        .createQueryBuilder('booking')
        .leftJoinAndSelect('booking.market', 'market')
        .where('booking.status IN (:...statuses)', { statuses: ['pending', 'booked', 'pending_verification'] })
        .andWhere('booking.startDate <= :end', { end: endStr })
        .andWhere('booking.endDate >= :start', { start: startStr })
        .getMany();

      console.log('📋 Found bookings:', bookings.length);
      console.log('📋 Booking details:', bookings.map(b => ({
        id: b.id,
        marketId: b.market?.id,
        marketCode: b.market?.code,
        startDate: b.startDate,
        endDate: b.endDate,
        status: b.status
      })));

      // สร้าง Map ของ Booking เพื่อให้ search เร็วขึ้น (Key = MarketID)
      // หรือจะใช้ Array.find ก็ได้ถ้าข้อมูลไม่เยอะมาก แต่ Map เร็วกว่า
      const bookingMap = new Map<number, any>();
      bookings.forEach(b => {
        // ถ้ามีหลาย booking ในช่วงเวลาเดียวกัน (ในทางทฤษฎีไม่ควรมีถ้า validation ดี)
        // เราจะให้ความสำคัญกับ booked ก่อน pending
        if (b.market) {
          const existing = bookingMap.get(b.market.id);
          if (!existing || (existing.status === 'pending' && b.status === 'booked')) {
            bookingMap.set(b.market.id, b);
          }
        }
      });

      // 3. Map Status
      const marketStatuses = allMarkets.map(market => {
        let finalStatus = 'free'; // Default

        // เช็ค status ของตัว Market เองก่อน (เช่น ปิดปรับปรุง)
        if (market.status.toLowerCase() === 'maintenance') {
          finalStatus = 'maintenance';
        } else {
          // เช็ค Booking
          const booking = bookingMap.get(market.id);
          if (booking) {
            if (booking.status === 'booked') {
              finalStatus = 'booked';
            } else if (booking.status === 'pending' || booking.status === 'pending_verification') {
              finalStatus = 'pending';
            }
          }
        }

        return {
          id: market.id,
          code: market.code,
          price: market.price,
          status: finalStatus,
          // อาจจะส่งข้อมูล booking กลับไปด้วยก็ได้ถ้าจำเป็น
          bookingId: bookingMap.get(market.id)?.id || null
        };
      });

      return {
        status: 'success',
        data: marketStatuses,
        meta: {
          date: date || `${startDate} - ${endDate}`,
          total: allMarkets.length,
          deletedCount: deletedCount
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  async findOne(id: number) {
    console.log("🚀 ~ MarketService ~ findOne ~ id:", id)
    const market = await this.marketRepository.findOne({ where: { id } });
    if (!market) {
      throw new NotFoundException(`Market with ID ${id} not found`);
    }
    return {
      status: 'success',
      data: market,
    };
  }

  async update(id: number, updateMarketDto: UpdateMarketDto) {
    return await this.marketRepository.update(id, updateMarketDto);
  }


  async remove(id: number) {
    return await this.marketRepository.delete(id);
  }

  async cancelBooking(id: number) {
    const booking = await this.bookingRepository.findOne({ where: { id } });
    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    booking.status = 'cancelled';
    return this.bookingRepository.save(booking);
  }
  async cleanupExpiredBookings() {
    // 1. Auto-cancel pending bookings older than 1 minute
    const expiredDate = new Date(Date.now() - 1 * 60 * 1000); // 1 minute ago

    const expiredResult = await this.bookingRepository.update({
      status: 'pending',
      createdAt: LessThan(expiredDate),
    }, {
      status: 'cancelled'
    });

    // 2. Auto-cancel unconfirmed bookings past their end date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pastDueResult = await this.bookingRepository.update({
      status: In(['pending', 'pending_verification']),
      startDate: LessThan(today),
    }, {
      status: 'cancelled'
    });

    const expiredCount = expiredResult.affected || 0;
    const pastDueCount = pastDueResult.affected || 0;
    const totalAffected = expiredCount + pastDueCount;

    if (totalAffected > 0) {
      console.log(`trash Cleanup: Cancelled ${expiredCount} expired pending, ${pastDueCount} past due bookings.`);
      return totalAffected;
    }
    return 0;
  }

  async setMarketStatus(id: number, status: string) {
    return await this.marketRepository.update(id, { status });
  }
}
