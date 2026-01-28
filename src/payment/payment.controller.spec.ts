import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('PaymentController', () => {
  let controller: PaymentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [PaymentService],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findByUser', () => {
    it('should return an array of payments', async () => {
      const result = [];
      jest.spyOn(controller, 'findByUser').mockImplementation(async () => result);
      expect(await controller.findByUser('1')).toBe(result);
    });
  });
});
