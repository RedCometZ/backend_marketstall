import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, In, LessThanOrEqual, MoreThanOrEqual, IsNull, EntityManager } from 'typeorm';
import { CreateMarketDto } from './dto/create-market.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { CreateBookingDto } from '../booking/dto/create-booking.dto';
import { BookingService } from '../booking/booking.service';
import { Market } from './entities/market.entity';
import { Booking } from '../booking/entities/booking.entity';
import { Payment } from '../payment/entities/payment.entity';
import { User } from '../user/entities/user.entity';
import { StallMaintenance } from './entities/stall-maintenance.entity';

@Injectable()
export class MarketService {
  constructor(
    @InjectRepository(Market)
    private marketRepository: Repository<Market>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(StallMaintenance)
    private maintenanceRepository: Repository<StallMaintenance>,
    private dataSource: DataSource,
    @InjectRepository(StallMaintenance)
    private stallMaintenanceRepository: Repository<StallMaintenance>,
    private bookingService: BookingService,
  ) { }

  create(createMarketDto: CreateMarketDto) {
    return this.marketRepository.save(createMarketDto);
  }

  // --- Private Helpers for Transactional Logic ---

  private async _createMaintenance(manager: EntityManager, marketId: number, startDate: string | Date, endDate: string | Date) {
    // Guard: ถ้ามี batch maintenance อยู่ ห้ามตั้ง maintenance รายแผง
    const activeBatch = await manager.findOne(StallMaintenance, {
      where: { stall: IsNull(), isBatch: true, status: 'ACTIVE' }
    });
    if (activeBatch) {
      throw new BadRequestException('ไม่สามารถตั้ง maintenance รายแผงได้ กรุณายกเลิก "ปิดปรับปรุงทั้งตลาด" ก่อน');
    }

    const market = await manager.findOne(Market, { where: { id: marketId } });
    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    // Cancel currently active maintenance records for this stall
    await manager.update(StallMaintenance, { stall: { id: marketId }, status: 'ACTIVE' }, { status: 'CANCELLED' });

    // Create new maintenance record
    const maintenance = manager.create(StallMaintenance, {
      stall: market,
      startDate: startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate,
      endDate: endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate,
      status: 'ACTIVE'
    });

    return await manager.save(maintenance);
  }

  private async _clearMaintenance(manager: EntityManager, marketId: number) {
    // Cancel all active per-stall maintenance records
    await manager.update(StallMaintenance, { stall: { id: marketId }, status: 'ACTIVE' }, { status: 'CANCELLED' });

    // Reset Market entity status to available
    await manager.update(Market, marketId, {
      status: 'available',
      maintenanceStartDate: null as any,
      maintenanceEndDate: null as any,
    });

    return { message: 'Maintenance cleared' };
  }

  // --- Public Methods ---

  async createMaintenance(marketId: number, startDate: string, endDate: string) {
    return this.dataSource.transaction(async (manager) => {
      // 1. Create StallMaintenance (History)
      const maintenance = await this._createMaintenance(manager, marketId, startDate, endDate);

      // 2. Update Market Entity (Current Status & Legacy Fields)
      await manager.update(Market, marketId, {
        status: 'maintenance',
        maintenanceStartDate: new Date(startDate),
        maintenanceEndDate: new Date(endDate),
      });

      return maintenance;
    });
  }

  async clearMaintenance(marketId: number) {
    return this.dataSource.transaction(async (manager) => {
      return this._clearMaintenance(manager, marketId);
    });
  }

  async createBooking(createBookingDto: CreateBookingDto) {
    try {
      await this.bookingService.cleanupExpiredBookings();
      return await this.bookingService.create(createBookingDto);
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      }
    }
  }

  async findAll() {
    // console.log("🚀 ~ MarketService ~ findAll ~ findAll:")
    try {
      const deletedCount = await this.bookingService.cleanupExpiredBookings();

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
      const deletedCount = await this.bookingService.cleanupExpiredBookings();

      let queryStartDate: Date;
      let queryEndDate: Date;

      // กำหนดช่วงวันที่ตามพารามิเตอร์ที่ส่งมา
      if (date) {
        // กรณีค้นหาแค่วันเดียว: ?date=2026-05-28
        queryStartDate = new Date(date);
        queryEndDate = new Date(date);
        // console.log('🔍 Single date query:', date);
      } else if (startDate && endDate) {
        // กรณีค้นหาช่วงวันที่: ?startDate=2026-02-01&endDate=2026-02-05
        queryStartDate = new Date(startDate);
        queryEndDate = new Date(endDate);
        // console.log('🔍 Date range query:', { startDate, endDate });
      } else {
        throw new Error('กรุณาระบุวันที่ (date) หรือช่วงวันที่ (startDate และ endDate)');
      }

      // console.log('🔍 Checking availability:', {
      //   start: queryStartDate.toISOString().split('T')[0],
      //   end: queryEndDate.toISOString().split('T')[0]
      // });

      // ดึงแผงทั้งหมดที่มีสถานะ 'available', 'Available', 'free', 'Free'
      const allMarkets = await this.marketRepository.find({
        where: [
          { status: 'Available' },
          { status: 'available' }, // Lowercase
          { status: 'free' },
          { status: 'Free' },
          { status: 'maintenance' } // Include maintenance to check against new table
        ],
        relations: ['maintenances'] // Load maintenances
      });

      // Filter out active maintenance based on dates
      const activeMarkets = allMarkets.filter(market => {
        // Check for active maintenance in new entity
        const activeMaintenance = market.maintenances?.find(m =>
          m.status === 'ACTIVE' &&
          new Date(m.startDate) <= queryEndDate &&
          new Date(m.endDate) >= queryStartDate
        );

        if (activeMaintenance) {
          return false;
        }

        // Fallback to legacy check if no new maintenance found (optional, but good for safety)
        if (market.maintenanceStartDate && market.maintenanceEndDate) {
          const start = new Date(market.maintenanceStartDate);
          const end = new Date(market.maintenanceEndDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);

          // Check overlap: query overlap with maintenance
          if (queryStartDate <= end && queryEndDate >= start) {
            return false; // In maintenance
          }
        } else if (market.status.toLowerCase() === 'maintenance' && !market.maintenances?.some(m => m.status === 'ACTIVE')) {
          // Only consider legacy 'maintenance' status if there are no active maintenance records (to avoid double blocking if migrating)
          // But if we are strictly using the new system, maybe we should ignore the old status string if there are no dates?
          // Keeping it safe: if status is maintenance AND no dates, it's permanently closed/maintenance.
          return false;
        }
        return true;
      });

      // console.log('📊 Total markets with status available (or expired maintenance):', activeMarkets.length);

      // ดึงการจองทั้งหมดที่ทับซ้อนกับช่วงวันที่ที่ต้องการ
      const bookings = await this.bookingRepository
        .createQueryBuilder('booking')
        .leftJoinAndSelect('booking.market', 'market')
        .where('booking.status IN (:...statuses)', { statuses: ['pending', 'booked', 'pending_verification'] })
        .andWhere('booking.startDate <= :end', { end: queryEndDate.toISOString().split('T')[0] })
        .andWhere('booking.endDate >= :start', { start: queryStartDate.toISOString().split('T')[0] })
        .getMany();

      // console.log('📋 Found bookings:', bookings.length);
      // console.log('📋 Booking details:', bookings.map(b => ({
      //   id: b.id,
      //   marketId: b.market?.id,
      //   marketCode: b.market?.code,
      //   startDate: b.startDate,
      //   endDate: b.endDate,
      //   status: b.status
      // })));

      // สร้าง Set ของ market IDs ที่ถูกจองแล้ว
      const bookedMarketIds = new Set(bookings.map(b => b.market?.id).filter(id => id));

      // console.log('🔴 Booked market IDs:', Array.from(bookedMarketIds));

      // กรองแผงที่ว่าง (ต้องมี status = available และไม่ถูกจอง)
      const availableMarkets = activeMarkets.filter(market => !bookedMarketIds.has(market.id));

      // console.log('✅ Available markets:', availableMarkets.length);

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
      const deletedCount = await this.bookingService.cleanupExpiredBookings();

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
      const allMarkets = await this.marketRepository.find({
        relations: ['maintenances']
      });

      const endStr = queryEndDate.toISOString().split('T')[0];
      const startStr = queryStartDate.toISOString().split('T')[0];

      // ดึงการจองทั้งหมดที่ทับซ้อนกับช่วงวันที่ที่ต้องการ
      const bookings = await this.bookingRepository
        .createQueryBuilder('booking')
        .leftJoinAndSelect('booking.market', 'market')
        // Include 'finished' in the query to respect DB status
        .where('booking.status IN (:...statuses)', { statuses: ['pending', 'booked', 'pending_verification', 'finished'] })
        .andWhere('booking.startDate <= :end', { end: endStr })
        .andWhere('booking.endDate >= :start', { start: startStr })
        .getMany();

      // console.log('📋 Found bookings:', bookings.length);
      // console.log('📋 Booking details:', bookings.map(b => ({
      //   id: b.id,
      //   marketId: b.market?.id,
      //   marketCode: b.market?.code,
      //   startDate: b.startDate,
      //   endDate: b.endDate,
      //   status: b.status
      // })));

      // สร้าง Map ของ Booking เพื่อให้ search เร็วขึ้น (Key = MarketID)
      // หรือจะใช้ Array.find ก็ได้ถ้าข้อมูลไม่เยอะมาก แต่ Map เร็วกว่า
      const bookingMap = new Map<number, any>();
      bookings.forEach(b => {
        // ถ้ามีหลาย booking ในช่วงเวลาเดียวกัน (ในทางทฤษฎีไม่ควรมีถ้า validation ดี)
        // เราจะให้ความสำคัญกับ booked ก่อน pending, และ finished เป็นความสำคัญต่ำสุด (ถ้ามีซ้อน)
        if (b.market) {
          const existing = bookingMap.get(b.market.id);

          // Priority: BOOKED > PENDING > FINISHED
          // If existing is FINISHED, and new is BOOKED/PENDING, overwrite.
          // If existing is PENDING, and new is BOOKED, overwrite.
          if (!existing) {
            bookingMap.set(b.market.id, b);
          } else {
            const priorities = { 'booked': 3, 'pending': 2, 'pending_verification': 2, 'finished': 1 };
            const existingP = priorities[existing.status] || 0;
            const newP = priorities[b.status] || 0;

            if (newP > existingP) {
              bookingMap.set(b.market.id, b);
            }
          }
        }
      });

      // Check for BATCH maintenance (stall IS NULL, isBatch = true)
      const batchMaintenance = await this.stallMaintenanceRepository.findOne({
        where: {
          stall: IsNull(),
          isBatch: true,
          status: 'ACTIVE',
          startDate: LessThanOrEqual(endStr),
          endDate: MoreThanOrEqual(startStr),
        }
      });

      // 3. Map Status
      const marketStatuses = allMarkets.map(market => {
        let finalStatus = 'available'; // Default state is AVAILABLE (changed from free)

        // 0. Check Batch Maintenance first (applies to ALL stalls)
        if (batchMaintenance) {
          finalStatus = 'maintenance';
        }

        // 1. Check per-stall Maintenance (Highest Priority)
        // Check new StallMaintenance entity
        if (finalStatus !== 'maintenance') {
          const activeMaintenance = market.maintenances?.find(m =>
            m.status === 'ACTIVE' &&
            new Date(m.startDate) <= queryEndDate &&
            new Date(m.endDate) >= queryStartDate
          );

          if (activeMaintenance) {
            finalStatus = 'maintenance';
          }
        }

        // 2. Check Bookings (If not maintenance)
        if (finalStatus !== 'maintenance') {
          const booking = bookingMap.get(market.id);
          if (booking) {
            if (booking.status === 'booked') {
              // Check if finished (endDate < now)
              const bookingEnd = new Date(booking.endDate);
              bookingEnd.setHours(23, 59, 59, 999); // End of the booking day
              if (bookingEnd < new Date()) {
                finalStatus = 'finished';
              } else {
                finalStatus = 'booked';
              }
            } else if (booking.status === 'pending' || booking.status === 'pending_verification') {
              finalStatus = 'pending';
            } else if (booking.status === 'finished') {
              // Explicit finished status from DB
              finalStatus = 'finished';
            }
          }
        }

        // 3. Check for "Disabled" state if applicable
        if (market.status.toLowerCase() === 'disabled') {
          finalStatus = 'disabled';
        }

        return {
          id: market.id,
          code: market.code,
          price: market.price,
          status: finalStatus.toUpperCase(), // Return uppercase as requested (AVAILABLE, BOOKED, PENDING, MAINTENANCE)
          // Send maintenance details for frontend to show "Upcoming Maintenance" if needed
          maintenance: (market.maintenanceStartDate && market.maintenanceEndDate) ? {
            startDate: market.maintenanceStartDate,
            endDate: market.maintenanceEndDate
          } : null,
          maintenanceHistory: market.maintenances ? market.maintenances
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()) // Newest first
            .map(m => ({
              id: m.id,
              startDate: m.startDate,
              endDate: m.endDate,
              status: m.status
            })) : [],
          booking: bookingMap.get(market.id) ? {
            id: bookingMap.get(market.id).id,
            status: bookingMap.get(market.id).status
          } : null
        };
      });

      // Check for ANY BATCH maintenance (even outside selected dates)
      const anyActiveBatch = await this.stallMaintenanceRepository.findOne({
        where: {
          stall: IsNull(),
          isBatch: true,
          status: 'ACTIVE',
        }
      });

      return {
        status: 'success',
        data: marketStatuses,
        meta: {
          date: date || `${startDate} - ${endDate}`,
          total: allMarkets.length,
          deletedCount: deletedCount,
          hasActiveBatchMaintenance: !!anyActiveBatch
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
    // console.log("🚀 ~ MarketService ~ findOne ~ id:", id)
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
    // 1. Load current market
    const market = await this.marketRepository.findOne({ where: { id } });
    if (!market) {
      throw new NotFoundException(`Market with ID ${id} not found`);
    }

    // 2. Idempotency Check (status, price, AND maintenance dates)
    const isStatusSame = updateMarketDto.status ? market.status === updateMarketDto.status : true;
    const isPriceSame = updateMarketDto.price !== undefined ? updateMarketDto.price === market.price : true;

    // Check maintenance dates for equality
    // Only check if provided in DTO. If undefined, it means "no change requested".
    const isMaintenanceStartSame = updateMarketDto.maintenanceStartDate === undefined ||
      (new Date(updateMarketDto.maintenanceStartDate || '').getTime() === new Date(market.maintenanceStartDate || '').getTime());

    const isMaintenanceEndSame = updateMarketDto.maintenanceEndDate === undefined ||
      (new Date(updateMarketDto.maintenanceEndDate || '').getTime() === new Date(market.maintenanceEndDate || '').getTime());

    // Allow updates if ANY relevant field has changed
    // Invert logic: Skip if ALL provided fields are same as current
    if (isStatusSame && isPriceSame && isMaintenanceStartSame && isMaintenanceEndSame) {
      // Nothing meaningful changed
      return {
        generatedMaps: [],
        raw: [],
        affected: 0
      };
    }

    // 3. Process Update in Transaction
    return this.dataSource.transaction(async (manager) => {
      // 4. Check for Maintenance Action (Create vs Clear)

      // Case A: Create Maintenance (Both Start & End Provided)
      if (updateMarketDto.maintenanceStartDate && updateMarketDto.maintenanceEndDate) {
        await this._createMaintenance(manager, id, updateMarketDto.maintenanceStartDate, updateMarketDto.maintenanceEndDate);
      }

      // Case B: Clear Maintenance (Explicit Null)
      // Check for explicit null (clearing)
      if (updateMarketDto.maintenanceStartDate === null || updateMarketDto.maintenanceEndDate === null) {
        await this._clearMaintenance(manager, id);
      }

      // 5. Update Market Entity (Legacy Columns + Other Fields)
      // We must update the legacy columns on the Market entity so that
      // findAvailableMarkets (which checks legacy) and findMarketStatuses (which sends legacy dates) continue to work correctly.
      // updateMarketDto already contains the dates (or nulls), so we just pass it through.

      return await manager.update(Market, id, updateMarketDto);
    });
  }

  async remove(id: number) {
    return await this.marketRepository.delete(id);
  }

  async getMaintenance(id: number) {
    const market = await this.marketRepository.findOne({
      where: { id },
      relations: ['maintenances'],
      order: {
        maintenances: {
          startDate: 'DESC'
        }
      }
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${id} not found`);
    }

    return {
      status: 'success',
      data: market.maintenances
    };
  }
  async getAllMaintenance(limit?: number) {
    return await this.stallMaintenanceRepository.find({
      relations: ['stall'],
      order: { startDate: 'DESC' },
      take: limit ?? undefined,
    });
  }

  async setBatchMaintenance(startDate: string, endDate: string) {
    return this.dataSource.transaction(async (manager) => {

      const start = new Date(startDate);
      const end = new Date(endDate);

      // 1. ปิด maintenance เก่าทั้งหมด (ทั้ง batch และ per-stall)
      await manager
        .createQueryBuilder()
        .update(StallMaintenance)
        .set({ status: 'CANCELLED' })
        .where('status = :status', { status: 'ACTIVE' })
        .execute();

      // 2. รีเซ็ตทุกแผงเป็น available ก่อน (ล้างสถานะเก่า)
      await manager
        .createQueryBuilder()
        .update(Market)
        .set({
          status: 'available',
          maintenanceStartDate: null,
          maintenanceEndDate: null,
        })
        .execute();

      // 3. update ทุกแผงเป็น maintenance ใหม่
      await manager
        .createQueryBuilder()
        .update(Market)
        .set({
          status: 'maintenance',
          maintenanceStartDate: start,
          maintenanceEndDate: end,
        })
        .execute();

      // 4. สร้าง batch ใหม่ (ใช้ QueryBuilder เพื่อให้แน่ใจว่า isBatch = true ถูก save)
      const result = await manager
        .createQueryBuilder()
        .insert()
        .into(StallMaintenance)
        .values({
          stall: null,
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          isBatch: true,
          status: 'ACTIVE',
        })
        .execute();

      return result;
    });
  }

  async cancelBatchMaintenance() {
    return this.dataSource.transaction(async (manager) => {
      // 1. ปิด maintenance ทั้งหมด (ทั้ง batch และ per-stall) เพื่อให้แน่ใจว่าเปิดตลาดได้จริง
      await manager
        .createQueryBuilder()
        .update(StallMaintenance)
        .set({ status: 'CANCELLED' })
        .where('status = :status', { status: 'ACTIVE' }) // ลบเงื่อนไข isBatch = true ออก
        .execute();

      // 2. รีเซ็ตทุกแผงเป็น available
      await manager
        .createQueryBuilder()
        .update(Market)
        .set({
          status: 'available',
          maintenanceStartDate: null,
          maintenanceEndDate: null,
        })
        .execute();

      return { message: 'ยกเลิกปิดปรับปรุงทั้งตลาดเรียบร้อย' };
    });
  }
  async cancelBooking(id: number) {
    const booking = await this.bookingRepository.findOne({ where: { id } });
    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    booking.status = 'cancelled';
    return this.bookingRepository.save(booking);
  }
  async onModuleInit() {
    // Migration: Convert 'EXPIRED' to 'COMPLETED'
    // This handles legacy data that might have been created before the enum change
    // We do this raw query or using repository if enum allows
    try {
      const expiredMaintenance = await this.stallMaintenanceRepository.find({
        where: { status: 'EXPIRED' }
      });

      if (expiredMaintenance.length > 0) {
        console.log(`🔄 Migrating ${expiredMaintenance.length} EXPIRED maintenance records to COMPLETED...`);
        await this.stallMaintenanceRepository.update(
          { status: 'EXPIRED' },
          { status: 'COMPLETED' }
        );
        console.log('✅ Migration finished.');
      }
    } catch (error) {
      console.log('⚠️ Migration skipped (probably EXPIRED enum removed already):', error.message);
    }
  }



}
