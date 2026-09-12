import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint } from './complaint.entity';
import { Customer } from '../customers/customer.entity';
import { CreateComplaintDto } from './dto/create-complaint.dto';

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async create(createComplaintDto: CreateComplaintDto): Promise<Complaint> {
    const customer = await this.customerRepo.findOne({
      where: { id: createComplaintDto.customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${createComplaintDto.customerId} not found`);
    }

    // 1. تسجل الشكوى
    const complaint = this.complaintRepo.create(createComplaintDto);
    const savedComplaint = await this.complaintRepo.save(complaint);

    // 2. تفعيل خصم الـ 10% للـ Next Reservation
    customer.hasCompensationDiscount = true;
    await this.customerRepo.save(customer);

    return savedComplaint;
  }

  async findAll(customerId?: string): Promise<Complaint[]> {
    const whereClause: any = {};
    if (customerId) {
      whereClause.customerId = customerId;
    }
    return this.complaintRepo.find({
      where: whereClause,
      relations: { customer: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Complaint> {
    const complaint = await this.complaintRepo.findOne({
      where: { id },
      relations: { customer: true },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${id} not found`);
    }

    return complaint;
  }

  async updateStatus(id: string, status: string): Promise<Complaint> {
    const complaint = await this.findOne(id);
    complaint.status = status;
    return this.complaintRepo.save(complaint);
  }
}