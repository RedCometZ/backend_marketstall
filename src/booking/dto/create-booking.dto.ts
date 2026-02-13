export class CreateBookingDto {
    marketId: number;
    code: string;
    userId: number;
    startDate: string;
    endDate: string;
    status?: string;
    adminId?: number;
}
