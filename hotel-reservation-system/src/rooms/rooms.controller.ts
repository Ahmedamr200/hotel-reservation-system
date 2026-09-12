import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { SearchRoomsDto } from './dto/search-rooms.dto';
import { AvailableRoomsDto } from './dto/available-rooms.dto';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto);
  }

  // IMPORTANT: this literal route MUST be declared before the ':id' route below.
  // Within the same controller, NestJS registers routes in declaration order,
  // so 'available' will always be matched correctly and never swallowed by ':id'.
  @Get('available')
  findAvailableRooms(@Query() query: AvailableRoomsDto) {
    return this.roomsService.findAvailableRooms(
      query.checkIn,
      query.checkOut,
      query.roomType,
      query.guests,
    );
  }

  @Get()
  findAll(@Query() filters: SearchRoomsDto) {
    return this.roomsService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }
}