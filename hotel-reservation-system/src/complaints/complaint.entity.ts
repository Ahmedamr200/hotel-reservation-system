import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from '../customers/customer.entity';

@Entity('complaints')
export class Complaint {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  customerId!: string;

  @Column({ nullable: true })
  reservationId?: string;

  @Column()
  category!: string;

  @Column('text')
  description!: string;

  @Column({ default: 'Under Review' })
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer!: Customer;
}