import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Room } from '../rooms/room.entity';
import { Customer } from '../customers/customer.entity';

export enum ReservationStatus {
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id !: string;

  @Column()
  roomId !: string;

  @Column()
  customerId !: string;

  @ManyToOne(() => Room, (room) => room.reservations)
  @JoinColumn({ name: 'roomId' })
  room !: Room;

  @ManyToOne(() => Customer, (customer) => customer.reservations)
  @JoinColumn({ name: 'customerId' })
  customer !: Customer;

  @Column({ type: 'date' })
  checkIn !: string;

  @Column({ type: 'date' })
  checkOut !: string;

  @Column({
    type: 'varchar',
    enum: ReservationStatus,
    default: ReservationStatus.CONFIRMED,
  })
  status !: ReservationStatus;

  @CreateDateColumn()
  createdAt !: Date;
}