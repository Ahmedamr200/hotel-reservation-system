import { IsEnum, IsOptional, IsNumberString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RoomType } from '../room.entity';

export class SearchRoomsDto {
  @IsOptional()
  @IsEnum(RoomType)
  roomType?: RoomType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests?: number;
}