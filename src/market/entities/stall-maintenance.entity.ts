import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Market } from './market.entity';

@Entity()
export class StallMaintenance {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Market, (market) => market.maintenances, {
        onDelete: 'CASCADE',
        nullable: true   // สำคัญสำหรับ BATCH
    })
    stall: Market | null;

    @Column({ type: 'date' })
    startDate: string;

    @Column({ type: 'date' })
    endDate: string;

    @Column({
        type: 'enum',
        enum: ['ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'],
        default: 'ACTIVE'
    })
    status: string;

    @Column({ default: false })
    isBatch: boolean;

    @CreateDateColumn()
    createdAt: Date;



}
