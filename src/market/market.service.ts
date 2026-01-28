import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) { }

  create(createMarketDto: CreateMarketDto) {
    return this.marketRepository.save(createMarketDto);
  }

  async createBooking(createBookingDto: CreateBookingDto) {
    console.log("🚀 ~ MarketService ~ createBooking ~ createBookingDto:", createBookingDto)
    const market = await this.marketRepository.findOne({ where: { id: createBookingDto.marketId } });
    if (!market) {
      throw new NotFoundException('Market not found');
    }

    const user = await this.userRepository.findOne({ where: { id: createBookingDto.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate duration and total price
    const start = new Date(createBookingDto.startDate);
    const end = new Date(createBookingDto.endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays <= 0) {
      throw new Error('Invalid booking date range');
    }

    const totalPrice = market.price * diffDays;
    console.log("🚀 ~ MarketService ~ createBooking ~ totalPrice:", totalPrice);

    const booking = this.bookingRepository.create({
      market,
      user,
      startDate: createBookingDto.startDate,
      endDate: createBookingDto.endDate,
      status: 'pending',
      price: totalPrice,
    });

    return this.bookingRepository.save(booking);
  }

  async findAll() {
    console.log("🚀 ~ MarketService ~ findAll ~ findAll:")
    try {
      const markets = await this.marketRepository.find({
        // relations: {
        //   bookings: true,
        // }
      });
      return {
        status: 'success',
        data: markets,
      }

    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      }
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
}

