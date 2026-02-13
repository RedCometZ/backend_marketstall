import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Payment } from "../../payment/entities/payment.entity";
import { Booking } from "../../booking/entities/booking.entity";

@Entity()
export class Admin {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    username: string;

    @Column()
    password: string;


    @OneToMany(() => Payment, (payment) => payment.admin)
    payments: Payment[];

    @OneToMany(() => Booking, (booking) => booking.admin)
    bookings: Booking[];
}
