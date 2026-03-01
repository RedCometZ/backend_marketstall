import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';
import { Admin } from '../admin/entities/admin.entity';

describe('PaymentService Revenue', () => {
    let service: PaymentService;
    let paymentRepositoryMock: any;

    beforeEach(async () => {
        paymentRepositoryMock = {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaymentService,
                { provide: getRepositoryToken(Payment), useValue: paymentRepositoryMock },
                { provide: getRepositoryToken(Booking), useValue: {} },
                { provide: getRepositoryToken(User), useValue: {} },
                { provide: getRepositoryToken(Admin), useValue: {} },
            ],
        }).compile();

        service = module.get<PaymentService>(PaymentService);
    });

    it('should calculate weekly revenue correctly', async () => {
        const mockPayments = [
            { price: 100, payment_status: 'approved' },
            { price: 200, payment_status: 'approved' },
        ];
        paymentRepositoryMock.find.mockResolvedValue(mockPayments);

        const result = await service.getWeeklyRevenue('2026-02-18');

        expect(paymentRepositoryMock.find).toHaveBeenCalled();
        expect(result.data.totalRevenue).toBe(300);
        expect(result.data.transactionCount).toBe(2);
    });

    it('should calculate monthly revenue correctly', async () => {
        const mockPayments = [
            { price: 50, payment_status: 'approved' },
            { price: 50, payment_status: 'approved' },
            { price: 50, payment_status: 'approved' },
        ];
        paymentRepositoryMock.find.mockResolvedValue(mockPayments);

        const result = await service.getMonthlyRevenue('2026-02-18');

        expect(paymentRepositoryMock.find).toHaveBeenCalled();
        expect(result.data.totalRevenue).toBe(150);
        expect(result.data.transactionCount).toBe(3);
    });

    it('should calculate daily revenue correctly', async () => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Mock repository to return payments for today
        const mockPayments = [
            { price: 100, payment_status: 'approved' },
            { price: 200, payment_status: 'approved' }
        ];
        paymentRepositoryMock.find.mockResolvedValue(mockPayments);

        const result = await service.getDailyRevenue(todayStr);

        expect(paymentRepositoryMock.find).toHaveBeenCalled();
        expect(result.data.totalRevenue).toBe(300);
        expect(result.data.transactionCount).toBe(2);
        expect(result.data.date).toBe(todayStr);
    });
});
