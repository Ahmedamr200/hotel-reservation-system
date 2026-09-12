import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { Reservation } from '../reservations/reservation.entity';

export enum RoomType {
  SINGLE = 'Single',
  DOUBLE = 'Double',
  TWIN = 'Twin',
  SUITE = 'Suite',
  FAMILY = 'Family',
}

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id !: string;

  @Column()
  roomNumber !: string;

  @Column({
    type: 'varchar',
    enum: RoomType,
  })
  roomType !: RoomType;

  @Column()
  capacity !: number;

  @Column('float')
  pricePerNight !: number;

  @Column()
  floor !: number;

  @OneToMany(() => Reservation, (reservation) => reservation.room)
  reservations !: Reservation[];
}