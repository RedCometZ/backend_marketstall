import { Controller, Get, Post, Delete, Body, ParseIntPipe, Query } from '@nestjs/common';
import { MarketService } from './market.service';

@Controller('maintenance')
export class MaintenanceController {
    constructor(private readonly marketService: MarketService) { }

    @Get()
    getAllMaintenance(@Query('limit', ParseIntPipe) limit?: number,) {
        return this.marketService.getAllMaintenance();
    }

    @Post('batch')
    setBatchMaintenance(
        @Body('startDate') startDate: string,
        @Body('endDate') endDate: string,
    ) {
        return this.marketService.setBatchMaintenance(startDate, endDate);
    }

    @Delete('batch')
    cancelBatchMaintenance() {
        return this.marketService.cancelBatchMaintenance();
    }
}