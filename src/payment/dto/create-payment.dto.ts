export class CreatePaymentDto {
    price: number;
    proof_of_payment?: string;
    payment_status: string;
    user_id: number;
    booking_id: number;
    payment_date?: Date;
}
