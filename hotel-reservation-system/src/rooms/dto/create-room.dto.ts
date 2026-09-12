import { IsEnum, IsInt, IsNumber, IsPositive, IsString } from 'class-validator';
import { RoomType } from '../room.entity';

export class CreateRoomDto {
  @IsString()
  roomNumber: string;

  @IsEnum(RoomType)
  roomType: RoomType;

  @IsInt()
  @IsPositive()
  capacity: number;

  @IsNumber()
  @IsPositive()
  pricePerNight: number;

  @IsInt()
  floor: number;
}