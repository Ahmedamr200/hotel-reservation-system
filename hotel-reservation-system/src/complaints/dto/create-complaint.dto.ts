import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateComplaintDto {
  @IsUUID()
  @IsNotEmpty()
  customerId!: string;

  @IsUUID()
  @IsOptional()
  reservationId?: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;
}