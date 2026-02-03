import { Booking } from "src/booking/entities/booking.entity";
import { User } from "src/user/entities/user.entity";
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, ManyToOne } from "typeorm";

@Entity()
export class Payment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'longtext', nullable: true })
    proof_of_payment: string;

    @Column()
    payment_status: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price: number;

    @ManyToOne(() => User, (user) => user.payments)
    user: User;

    @Column()
    payment_date: Date;

    @OneToOne(() => Booking, (booking) => booking.payment)
    @JoinColumn({ name: 'booking_id' })
    booking: Booking;
}
