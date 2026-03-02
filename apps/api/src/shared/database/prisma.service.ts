import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {

  }

  async onModuleDestroy() {

  }
}
