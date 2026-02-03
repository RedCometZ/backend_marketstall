import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Market } from '../../market/entities/market.entity';
import { Payment } from 'src/payment/entities/payment.entity';

@Entity()
export class Booking {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'date' })
    startDate: Date;

    @Column({ type: 'date' })
    endDate: Date;

    @Column({ default: 'pending' })
    status: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price: number;

    @ManyToOne(() => User, (user) => user.bookings)
    user: User;

    // @ManyToOne(() => Market)
    // market: Market;

    @Column()
    marketId: number;

    @ManyToOne(() => Market, (market) => market.bookings)
    market: Market;

    @OneToOne(() => Payment, (payment) => payment.booking)
    @JoinColumn({ name: 'pid' })
    payment: Payment;

    @CreateDateColumn()
    createdAt: Date;
}
