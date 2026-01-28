import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Booking } from '../../booking/entities/booking.entity';

@Entity()
export class Market {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    code: string;

    @Column()
    price: number;

    @Column({ default: 'available' })
    status: string;

    @OneToMany(() => Booking, (booking) => booking.market)
    bookings: Booking[];
}
