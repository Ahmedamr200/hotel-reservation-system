import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation, ReservationStatus } from './reservation.entity';
import { Room, RoomType } from '../rooms/room.entity';
import { Customer } from '../customers/customer.entity';
import { CustomersService } from '../customers/customers.service';
import { RoomsService } from '../rooms/rooms.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { CalculatePriceDto } from './dto/calculate-price.dto';


@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly customersService: CustomersService,
    private readonly roomsService: RoomsService,
  ) {}

  // ---------- Date validation helper ----------
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

  // ---------- Core overlap-based availability check ----------
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

  // ---------- GET /rooms/available ----------
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

  // ---------- CALCULATE PRICE (AI Tool support) ----------
  async calculatePrice(dto: CalculatePriceDto) {
    this.validateDates(dto.checkIn, dto.checkOut);

    const room = await this.roomRepository.findOne({ where: { id: dto.roomId } });
    if (!room) {
      throw new NotFoundException(`Room with ID ${dto.roomId} not found`);
    }

    const checkInDate = new Date(dto.checkIn);
    const checkOutDate = new Date(dto.checkOut);
    const totalNights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24),
    );

    const basePricePerNight = Number(room.pricePerNight);
    const baseTotal = basePricePerNight * totalNights;

    // 1. Group Discount
    let groupDiscount = 0;
    if (dto.guests >= 8) {
      groupDiscount = 8;
    } else if (dto.guests >= 5) {
      groupDiscount = 5;
    }

    // 2. Complaint Compensation Discount (10%)
    let compensationDiscount = 0;
    if (dto.customerId) {
      const customer = await this.customerRepository.findOne({
        where: { id: dto.customerId },
      });
      if (customer && customer.hasCompensationDiscount) {
        compensationDiscount = 10;
      }
    }

    // High precedence rule
    const discountPercentage = Math.max(groupDiscount, compensationDiscount);
    const discountAmount = (baseTotal * discountPercentage) / 100;
    const finalTotal = baseTotal - discountAmount;

    return {
      roomId: room.id,
      roomNumber: room.roomNumber,
      roomType: room.roomType,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      totalNights,
      guests: dto.guests,
      pricePerNight: basePricePerNight,
      baseTotal,
      discountPercentage,
      discountAmount,
      finalTotal,
    };
  }

  // ---------- POST /reservations ----------
  async create(dto: CreateReservationDto): Promise<Reservation> {
    this.validateDates(dto.checkIn, dto.checkOut);

    const customer = await this.customerRepository.findOne({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with id ${dto.customerId} not found`);
    }

    await this.roomsService.findOne(dto.roomId);

    const available = await this.isRoomAvailable(
      dto.roomId,
      dto.checkIn,
      dto.checkOut,
    );

    if (!available) {
      throw new ConflictException('Room is not available for the selected dates');
    }

    const reservation = this.reservationRepository.create({
      roomId: dto.roomId,
      customerId: dto.customerId,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      status: ReservationStatus.CONFIRMED,
    });

    const savedReservation = await this.reservationRepository.save(reservation);

    // إنهاء خصم التعويض بعد الاستخدام (لأنه للـ Next Reservation فقط)
    if (customer.hasCompensationDiscount) {
      customer.hasCompensationDiscount = false;
      await this.customerRepository.save(customer);
    }

    return savedReservation;
  }

  async findAll(customerId?: string): Promise<Reservation[]> {
    const whereClause: any = {};
    if (customerId) {
      whereClause.customerId = customerId;
    }
    return this.reservationRepository.find({
      where: whereClause,
      relations: { room: true, customer: true },
      order: { createdAt: 'DESC' } as any,
    });
  }

  async findOne(id: string): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
      relations: { room: true, customer: true },
    });
    if (!reservation) {
      throw new NotFoundException(`Reservation with id ${id} not found`);
    }
    return reservation;
  }

  // ---------- PATCH /reservations/:id ----------
  async update(id: string, dto: UpdateReservationDto): Promise<Reservation> {
    const reservation = await this.findOne(id);

    const newCheckIn = dto.checkIn ?? reservation.checkIn;
    const newCheckOut = dto.checkOut ?? reservation.checkOut;

    this.validateDates(newCheckIn, newCheckOut);

    const overlapping = await this.reservationRepository
      .createQueryBuilder('reservation')
      .where('reservation.roomId = :roomId', { roomId: reservation.roomId })
      .andWhere('reservation.id != :id', { id })
      .andWhere('reservation.status != :cancelled', {
        cancelled: ReservationStatus.CANCELLED,
      })
      .andWhere('reservation.checkIn < :checkOut', { checkOut: newCheckOut })
      .andWhere('reservation.checkOut > :checkIn', { checkIn: newCheckIn })
      .getCount();

    if (overlapping > 0) {
      throw new ConflictException('Room is not available for the new dates');
    }

    reservation.checkIn = newCheckIn;
    reservation.checkOut = newCheckOut;

    return this.reservationRepository.save(reservation);
  }

  // ---------- DELETE /reservations/:id ----------
  async cancel(id: string): Promise<Reservation> {
    const reservation = await this.findOne(id);
    reservation.status = ReservationStatus.CANCELLED;
    return this.reservationRepository.save(reservation);
  }
}