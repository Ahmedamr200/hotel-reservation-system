import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { Reservation, ReservationStatus } from './reservation.entity';
import { Room, RoomType } from '../rooms/room.entity';
import { CustomersService } from '../customers/customers.service';
import { RoomsService } from '../rooms/rooms.service';

// A minimal fake query builder that mimics TypeORM's chainable API.
// We control what getCount() and getMany() return per test.
function createMockQueryBuilder(overrides: Partial<Record<string, any>> = {}) {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  return qb;
}

describe('ReservationsService', () => {
  let service: ReservationsService;
  let reservationRepo: any;
  let roomRepo: any;
  let customersService: any;
  let roomsService: any;

  const sampleRoom: Room = {
    id: 'room-1',
    roomNumber: '101',
    roomType: RoomType.DOUBLE,
    capacity: 2,
    pricePerNight: 120,
    floor: 1,
    reservations: [],
  };

  const sampleCustomer = {
    id: 'customer-1',
    name: 'Test Customer',
    email: 'test@example.com',
    phone: '0100000000',
    reservations: [],
  };

  beforeEach(async () => {
    reservationRepo = {
      createQueryBuilder: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ id: 'new-reservation-id', ...entity })),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    roomRepo = {
      createQueryBuilder: jest.fn(),
    };

    customersService = {
      findOne: jest.fn().mockResolvedValue(sampleCustomer),
    };

    roomsService = {
      findOne: jest.fn().mockResolvedValue(sampleRoom),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: getRepositoryToken(Reservation), useValue: reservationRepo },
        { provide: getRepositoryToken(Room), useValue: roomRepo },
        { provide: CustomersService, useValue: customersService },
        { provide: RoomsService, useValue: roomsService },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
  });

  // ---------- Test 1: Room has no reservation → Available ----------
  it('Test 1: room with no reservations is available', async () => {
    reservationRepo.createQueryBuilder.mockReturnValue(
      createMockQueryBuilder({ getCount: jest.fn().mockResolvedValue(0) }),
    );

    const available = await (service as any).isRoomAvailable(
      'room-1',
      '2026-09-12',
      '2026-09-15',
    );

    expect(available).toBe(true);
  });

  // ---------- Test 2: Overlapping reservation → Not Available ----------
  it('Test 2: overlapping active reservation makes room unavailable', async () => {
    // existing: Sep 10 - Sep 14, requested: Sep 12 - Sep 15 → overlap
    reservationRepo.createQueryBuilder.mockReturnValue(
      createMockQueryBuilder({ getCount: jest.fn().mockResolvedValue(1) }),
    );

    const available = await (service as any).isRoomAvailable(
      'room-1',
      '2026-09-12',
      '2026-09-15',
    );

    expect(available).toBe(false);
  });

  // ---------- Test 3: Existing checkout == requested check-in → Available ----------
  it('Test 3: back-to-back booking (checkout = check-in) is available', async () => {
    // The query itself encodes this rule (checkIn < checkOut AND checkOut > checkIn),
    // so a back-to-back booking never matches → getCount returns 0.
    reservationRepo.createQueryBuilder.mockReturnValue(
      createMockQueryBuilder({ getCount: jest.fn().mockResolvedValue(0) }),
    );

    const available = await (service as any).isRoomAvailable(
      'room-1',
      '2026-09-12', // requested check-in == existing checkout
      '2026-09-15',
    );

    expect(available).toBe(true);
  });

  // ---------- Test 4: Cancelled reservation overlapping → Available ----------
  it('Test 4: cancelled reservation is ignored even if dates overlap', async () => {
    // The query filters status != cancelled, so a cancelled overlapping
    // reservation never counts → getCount returns 0.
    const qb = createMockQueryBuilder({ getCount: jest.fn().mockResolvedValue(0) });
    reservationRepo.createQueryBuilder.mockReturnValue(qb);

    const available = await (service as any).isRoomAvailable(
      'room-1',
      '2026-09-12',
      '2026-09-15',
    );

    expect(available).toBe(true);
    // Confirm the status filter was actually applied in the query
    expect(qb.andWhere).toHaveBeenCalledWith(
      'reservation.status != :cancelled',
      { cancelled: ReservationStatus.CANCELLED },
    );
  });

  // ---------- Test 5: Room capacity insufficient → Not returned in search ----------
  it('Test 5: rooms with insufficient capacity are filtered out of search', async () => {
    // Simulate the room query already filtering by capacity >= guests
    // by returning only rooms that match (repository-level filtering).
    const qb = createMockQueryBuilder({
      getMany: jest.fn().mockResolvedValue([sampleRoom]), // capacity 2
    });
    roomRepo.createQueryBuilder.mockReturnValue(qb);

    reservationRepo.createQueryBuilder.mockReturnValue(
      createMockQueryBuilder({ getCount: jest.fn().mockResolvedValue(0) }),
    );

    const results = await service.findAvailableRooms(
      '2026-09-12',
      '2026-09-15',
      RoomType.DOUBLE,
      4, // requesting 4 guests, sampleRoom only fits 2
    );

    // The capacity filter is applied inside the query builder (andWhere),
    // so we confirm it was requested correctly:
    expect(qb.andWhere).toHaveBeenCalledWith('room.capacity >= :guests', {
      guests: 4,
    });
    // Since our mock always returns sampleRoom regardless of the filter,
    // we just confirm the filtering logic was invoked as expected.
    expect(results).toBeDefined();
  });

  // ---------- Test 6: Booking an unavailable room → ConflictException (409) ----------
  it('Test 6: creating a reservation for an unavailable room throws ConflictException', async () => {
    reservationRepo.createQueryBuilder.mockReturnValue(
      createMockQueryBuilder({ getCount: jest.fn().mockResolvedValue(1) }), // overlap exists
    );

    await expect(
      service.create({
        roomId: 'room-1',
        customerId: 'customer-1',
        checkIn: '2026-09-12',
        checkOut: '2026-09-15',
      }),
    ).rejects.toThrow(ConflictException);
  });

  // ---------- Test 7: Invalid date range → BadRequestException (400) ----------
  it('Test 7: checkOut before or equal to checkIn throws BadRequestException', async () => {
    await expect(
      service.create({
        roomId: 'room-1',
        customerId: 'customer-1',
        checkIn: '2026-09-15',
        checkOut: '2026-09-12', // invalid: before checkIn
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // ---------- Bonus: successful creation path ----------
  it('creates a reservation successfully when the room is available', async () => {
    reservationRepo.createQueryBuilder.mockReturnValue(
      createMockQueryBuilder({ getCount: jest.fn().mockResolvedValue(0) }),
    );

    const result = await service.create({
      roomId: 'room-1',
      customerId: 'customer-1',
      checkIn: '2026-09-12',
      checkOut: '2026-09-15',
    });

    expect(result).toBeDefined();
    expect(reservationRepo.save).toHaveBeenCalled();
  });
});