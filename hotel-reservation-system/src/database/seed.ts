import { DataSource } from 'typeorm';
import { Room, RoomType } from '../rooms/room.entity';
import { Customer } from '../customers/customer.entity';
import { Reservation, ReservationStatus } from '../reservations/reservation.entity';

const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: 'hotel.sqlite',
  entities: [Room, Customer, Reservation],
  synchronize: true,
});

// Helper to build a date string offset from today
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function seed() {
  await AppDataSource.initialize();
  console.log('Connected to database.');

  const roomRepo = AppDataSource.getRepository(Room);
  const customerRepo = AppDataSource.getRepository(Customer);
  const reservationRepo = AppDataSource.getRepository(Reservation);

  // ---------- 1. Clear existing data (order matters: reservations first, due to FKs) ----------
  await reservationRepo.clear();
  await roomRepo.clear();
  await customerRepo.clear();
  console.log('Old data cleared.');

  // ---------- 2. Seed Rooms (50 rooms) ----------
  const roomTypeConfigs: { type: RoomType; capacity: number; basePrice: number }[] = [
    { type: RoomType.SINGLE, capacity: 1, basePrice: 60 },
    { type: RoomType.DOUBLE, capacity: 2, basePrice: 110 },
    { type: RoomType.TWIN, capacity: 2, basePrice: 100 },
    { type: RoomType.SUITE, capacity: 4, basePrice: 250 },
    { type: RoomType.FAMILY, capacity: 5, basePrice: 200 },
  ];

  const rooms: Room[] = [];
  let roomCounter = 1;

  for (let floor = 1; floor <= 5; floor++) {
    for (let i = 0; i < 10; i++) {
      const config = roomTypeConfigs[roomCounter % roomTypeConfigs.length];
      const room = roomRepo.create({
        roomNumber: `${floor}${(i + 1).toString().padStart(2, '0')}`,
        roomType: config.type,
        capacity: config.capacity,
        pricePerNight: config.basePrice + (roomCounter % 4) * 10,
        floor,
      });
      rooms.push(room);
      roomCounter++;
    }
  }

  const savedRooms = await roomRepo.save(rooms);
  console.log(`${savedRooms.length} rooms created.`);

  // ---------- 3. Seed Customers (10 customers) ----------
  const customerData = [
    { name: 'Ahmed Hassan', email: 'ahmed.hassan@example.com', phone: '01011112222', password: 'password123' },
    { name: 'Sara Ibrahim', email: 'sara.ibrahim@example.com', phone: '01022223333', password: 'password123' },
    { name: 'Omar Khaled', email: 'omar.khaled@example.com', phone: '01033334444', password: 'password123' },
    { name: 'Mona Adel', email: 'mona.adel@example.com', phone: '01044445555', password: 'password123' },
    { name: 'Youssef Tarek', email: 'youssef.tarek@example.com', phone: '01055556666', password: 'password123' },
    { name: 'Nour Mahmoud', email: 'nour.mahmoud@example.com', phone: '01066667777', password: 'password123' },
    { name: 'Karim Fathy', email: 'karim.fathy@example.com', phone: '01077778888', password: 'password123' },
    { name: 'Laila Samir', email: 'laila.samir@example.com', phone: '01088889999', password: 'password123' },
    { name: 'Hassan Reda', email: 'hassan.reda@example.com', phone: '01099990000', password: 'password123' },
    { name: 'Dina Wael', email: 'dina.wael@example.com', phone: '01010101010', password: 'password123' },
  ];

  const customers = customerRepo.create(customerData);
  const savedCustomers = await customerRepo.save(customers);
  console.log(`${savedCustomers.length} customers created.`);

  // ---------- 4. Seed Reservations (20 reservations) ----------
  const reservations: Reservation[] = [];

  for (let i = 0; i < 20; i++) {
    const room = savedRooms[i % savedRooms.length];
    const customer = savedCustomers[i % savedCustomers.length];

    // Spread bookings across different future date ranges
    const startOffset = (i % 10) * 5; // staggered start days
    const stayLength = 2 + (i % 4); // 2-5 nights

    // Make every 5th reservation cancelled, to test that cancelled ones are ignored
    const status =
      i % 5 === 0 ? ReservationStatus.CANCELLED : ReservationStatus.CONFIRMED;

    const reservation = reservationRepo.create({
      roomId: room.id,
      customerId: customer.id,
      checkIn: dateOffset(startOffset),
      checkOut: dateOffset(startOffset + stayLength),
      status,
    });

    reservations.push(reservation);
  }

  const savedReservations = await reservationRepo.save(reservations);
  console.log(`${savedReservations.length} reservations created.`);

  await AppDataSource.destroy();
  console.log('Seeding complete. Connection closed.');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});