import { IsUUID, IsDateString } from 'class-validator';

export class CreateReservationDto {
  @IsUUID()
  roomId !: string;

  @IsUUID()
  customerId !: string;

  @IsDateString()
  checkIn !: string;

  @IsDateString()
  checkOut !: string;
}