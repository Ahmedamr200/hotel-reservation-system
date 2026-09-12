import { IsUUID, IsNotEmpty, IsDateString, IsInt, Min, IsOptional } from 'class-validator';

export class CalculatePriceDto {
  @IsUUID()
  @IsNotEmpty()
  roomId!: string;

  @IsDateString()
  @IsNotEmpty()
  checkIn!: string;

  @IsDateString()
  @IsNotEmpty()
  checkOut!: string;

  @IsInt()
  @Min(1)
  guests!: number;

  @IsUUID()
  @IsOptional()
  customerId?: string;
}