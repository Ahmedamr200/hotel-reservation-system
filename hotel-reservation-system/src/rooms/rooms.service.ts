import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomType } from './room.entity';
import { Reservation, ReservationStatus } from '../reservations/reservation.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { SearchRoomsDto } from './dto/search-rooms.dto';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
  ) {}

  async create(dto: CreateRoomDto): Promise<Room> {
    const room = this.roomRepository.create(dto);
    return this.roomRepository.save(room);
  }

  async findAll(filters: SearchRoomsDto): Promise<Room[]> {
    const query = this.roomRepository.createQueryBuilder('room');

    if (filters.roomType) {
      query.andWhere('room.roomType = :roomType', { roomType: filters.roomType });
    }
    if (filters.guests) {
      query.andWhere('room.capacity >= :guests', { guests: filters.guests });
    }
    if (filters.minPrice !== undefined) {
      query.andWhere('room.pricePerNight >= :minPrice', { minPrice: filters.minPrice });
    }
    if (filters.maxPrice !== undefined) {
      query.andWhere('room.pricePerNight <= :maxPrice', { maxPrice: filters.maxPrice });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<Room> {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) {
      throw new NotFoundException(`Room with id ${id} not found`);
    }
    return room;
  }

  private validateDates(checkIn: string, checkOut: string) {
    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);

    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    if (outDate <= inDate) {
      throw new BadRequestException('checkOut must be after checkIn');
    }
  }

  private async isRoomAvailable(
    roomId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<boolean> {
    const overlapping = await this.reservationRepository
      .createQueryBuilder('reservation')
      .where('reservation.roomId = :roomId', { roomId })
      .andWhere('reservation.status != :cancelled', {
        cancelled: ReservationStatus.CANCELLED,
      })
      .andWhere('reservation.checkIn < :checkOut', { checkOut })
      .andWhere('reservation.checkOut > :checkIn', { checkIn })
      .getCount();

    return overlapping === 0;
  }

  async findAvailableRooms(
    checkIn: string,
    checkOut: string,
    roomType?: RoomType,
    guests?: number,
  ): Promise<Room[]> {
    this.validateDates(checkIn, checkOut);

    const query = this.roomRepository.createQueryBuilder('room');

    if (roomType) {
      query.andWhere('room.roomType = :roomType', { roomType });
    }
    if (guests) {
      query.andWhere('room.capacity >= :guests', { guests });
    }

    const candidateRooms = await query.getMany();

    const availableRooms: Room[] = [];
    for (const room of candidateRooms) {
      const available = await this.isRoomAvailable(room.id, checkIn, checkOut);
      if (available) {
        availableRooms.push(room);
      }
    }

    return availableRooms;
  }
}