import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { RoomsModule } from './rooms/rooms.module';
import { CustomersModule } from './customers/customers.module';
import { ReservationsModule } from './reservations/reservations.module';
import { ComplaintsModule } from './complaints/complaints.module';

import { Room } from './rooms/room.entity';
import { Customer } from './customers/customer.entity';
import { Reservation } from './reservations/reservation.entity';
import { Complaint } from './complaints/complaint.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'hotel.sqlite',

      entities: [
        Room,
        Customer,
        Reservation,
        Complaint,
      ],

      synchronize: true,
    }),

    RoomsModule,
    CustomersModule,
    ReservationsModule,
    ComplaintsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}