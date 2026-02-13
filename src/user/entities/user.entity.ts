import { Column, Entity, OneToMany, PrimaryGeneratedColumn, CreateDateColumn } from "typeorm";
import { Booking } from "../../booking/entities/booking.entity";
import { Payment } from "src/payment/entities/payment.entity";

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    username: string;

    @Column()
    tel: string;

    @OneToMany(() => Booking, (booking) => booking.user)
    bookings: Booking[];

    @OneToMany(() => Payment, (payment) => payment.user)
    payments: Payment[];

    @CreateDateColumn()
    createdAt: Date;

}
