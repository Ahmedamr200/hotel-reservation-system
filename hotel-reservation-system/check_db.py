import sqlite3

con = sqlite3.connect("hotel.sqlite")
cur = con.cursor()

print("=== ALL ROOMS ===")
cur.execute("SELECT id, roomNumber, roomType, capacity, pricePerNight, floor FROM rooms")
for r in cur.fetchall():
    print(r)

print(f"\nTotal rooms: {cur.execute('SELECT COUNT(*) FROM rooms').fetchone()[0]}")

print("\n=== ALL RESERVATIONS ===")
cur.execute("SELECT id, roomId, customerId, checkIn, checkOut, status FROM reservations")
for r in cur.fetchall():
    print(r)

print(f"\nTotal reservations: {cur.execute('SELECT COUNT(*) FROM reservations').fetchone()[0]}")

con.close()