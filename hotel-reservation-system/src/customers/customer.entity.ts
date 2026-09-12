import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';

import { Reservation } from '../reservations/reservation.entity';

@Entity('customers')
export class Customer {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  phone!: string;

  @Column({ default: '123456' })
  password!: string;

  @Column({ default: false })
  hasCompensationDiscount!: boolean;

  @OneToMany(
    () => Reservation,
    (reservation) => reservation.customer,
  )
  reservations!: Reservation[];
}