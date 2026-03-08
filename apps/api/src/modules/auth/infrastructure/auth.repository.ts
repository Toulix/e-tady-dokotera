import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { UserType } from '../../../generated/prisma/enums';
import type { UserModel } from '../../../generated/prisma/models/User';

/**
 * All database access for the auth module is funneled through this repository.
 * Services and controllers never call Prisma directly — this boundary keeps
 * the data layer swappable and testable.
 */

export interface CreateUserData {
  phoneNumber: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  userType: UserType;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(data: CreateUserData): Promise<UserModel> {
    return this.prisma.user.create({
      data: {
        phoneNumber: data.phoneNumber,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        userType: data.userType,
      },
    });
  }

  async findByPhone(phone: string): Promise<UserModel | null> {
    return this.prisma.user.findUnique({
      where: { phoneNumber: phone },
    });
  }

  async findByEmail(email: string): Promise<UserModel | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<UserModel | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async markVerified(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { isVerified: true },
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }
}
