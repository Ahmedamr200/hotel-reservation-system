import { IsEnum, IsOptional, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RoomType } from '../room.entity';

export class AvailableRoomsDto {
  @IsOptional()
  @IsEnum(RoomType)
  roomType?: RoomType;

  @IsDateString()
  checkIn!: string;

  @IsDateString()
  checkOut!: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests?: number;
}