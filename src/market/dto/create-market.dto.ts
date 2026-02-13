export class CreateMarketDto {
    code: string;
    price: number;
    status: string;

    maintenanceStartDate?: Date;
    maintenanceEndDate?: Date;
}
