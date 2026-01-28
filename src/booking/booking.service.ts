import { Injectable } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { Booking } from './entities/booking.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Market } from '../market/entities/market.entity';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Market)
    private _market: Repository<Market>,
    @InjectRepository(Booking)
    private _booking: Repository<Booking>,
  ) { }


  async create(createBookingDto: CreateBookingDto) {
    try {
      const { marketId, userId, startDate, endDate } = createBookingDto;

      // 1. แปลงวันที่
      const start = new Date(startDate);
      const end = new Date(endDate);

      // 2. คำนวณจำนวนวัน (รวมวันแรก)
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      if (diffDays <= 0) {
        throw new Error('Invalid booking date range');
      }

      // 3. ดึงข้อมูล market
      const market = await this._market.findOne({
        where: { id: marketId },
      });

      if (!market) {
        throw new Error('Market not found');
      }

      // 4. คำนวณราคาจริง (Total Price for "Pay All at Once")
      const totalPrice = market.price * diffDays;
      console.log('DEBUG PRICE CALC:', { marketPrice: market.price, diffDays, totalPrice });

      // 5. สร้าง booking entity
      const booking = this._booking.create({
        user: { id: userId },
        market: { id: marketId },
        startDate,
        endDate,
        price: totalPrice,
        status: 'pending',
      });

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


  async findAll() {
    console.log("🚀 ~ BookingService ~ findAll ~ findAll:")
    try {

      const bookings = await this._booking.find({
        relations: {
          market: true,
          payment: true,
        }
      });
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

  findOne(id: number) {
    return `This action returns a #${id} booking`;
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
}
