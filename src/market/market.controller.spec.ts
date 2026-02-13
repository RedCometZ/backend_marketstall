import { Test, TestingModule } from '@nestjs/testing';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';

describe('MarketController', () => {
  let controller: MarketController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketController],
      providers: [MarketService],
    }).compile();

    controller = module.get<MarketController>(MarketController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // Basic check to ensure controller methods are callable
  it('should have findStatuses method', () => {
    expect(controller.findStatuses).toBeDefined();
  });
});
