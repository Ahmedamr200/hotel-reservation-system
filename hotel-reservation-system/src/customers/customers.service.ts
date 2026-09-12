import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Customer } from './customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  // ==========================================
  // Create Customer
  // ==========================================

  async create(dto: CreateCustomerDto): Promise<Customer> {
    const cleanEmail = dto.email.trim().toLowerCase();
    const existing = await this.customerRepository.findOne({
      where: { email: cleanEmail },
    });
    if (existing) {
      throw new BadRequestException(`Email ${cleanEmail} is already registered`);
    }

    const customer = this.customerRepository.create({
      ...dto,
      email: cleanEmail,
      name: dto.name.trim(),
      phone: dto.phone.trim(),
    });

    return this.customerRepository.save(customer);
  }

  // ==========================================
  // Get All Customers
  // ==========================================

  async findAll(): Promise<Customer[]> {
    return this.customerRepository.find();
  }

  // ==========================================
  // Get Customer By ID
  // ==========================================

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer with id ${id} not found`,
      );
    }

    return customer;
  }

  // ==========================================
  // Find By Email
  // ==========================================

  async findByEmail(email: string): Promise<Customer> {
    const cleanEmail = email.trim().toLowerCase();
    const customer = await this.customerRepository.findOne({
      where: { email: cleanEmail },
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer with email ${email} not found`,
      );
    }

    return customer;
  }

  // ==========================================
  // Find By Phone
  // ==========================================
async findByPhone(phone: string): Promise<Customer> {

  const customer = await this.customerRepository.findOne({
    where: { phone },
  });

  if (!customer) {
    throw new NotFoundException(
      `Customer with phone ${phone} not found`,
    );
  }

  return customer;
}
}