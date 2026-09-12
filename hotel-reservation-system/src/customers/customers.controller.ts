import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';

import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
  ) {}

  // ==========================================
  // Create Customer
  // POST /customers
  // ==========================================

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  // ==========================================
  // Login Customer
  // POST /customers/login
  // ==========================================

  @Post('login')
  async login(@Body() body: { email: string; password?: string }) {
    if (!body.email || !body.email.trim()) {
      throw new BadRequestException('Email is required / البريد الإلكتروني مطلوب');
    }
    if (!body.password || !body.password.trim()) {
      throw new BadRequestException('Password is required / كلمة المرور مطلوبة');
    }

    try {
      const customer = await this.customersService.findByEmail(body.email.trim());
      if (customer.password && customer.password !== body.password) {
        throw new BadRequestException('Invalid password / كلمة المرور غير صحيحة');
      }
      return customer;
    } catch (err: any) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException('Invalid email or password / البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
  }

  // ==========================================
  // Get All Customers
  // GET /customers
  // ==========================================

  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  // ==========================================
  // Find Customer By Email
  // GET /customers/by-email?email=...
  // ==========================================

  @Get('by-email')
  async findByEmail(@Query('email') email: string) {
    return this.customersService.findByEmail(email);
  }

  // ==========================================
  // Find Customer By Phone
  // GET /customers/by-phone?phone=...
  // ==========================================

  @Get('by-phone')
  async findByPhone(@Query('phone') phone: string) {
    return this.customersService.findByPhone(phone);
  }

  // ==========================================
  // Get Customer By ID
  // GET /customers/:id
  // ==========================================

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }
}