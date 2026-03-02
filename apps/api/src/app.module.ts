import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { RedisModule, REDIS_CLIENT } from './shared/redis/redis.module';
import { DatabaseModule } from './shared/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { DoctorsModule } from './modules/doctors/doctors.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { VideoModule } from './modules/video/video.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    // Config must be first — everything else depends on ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),

    // Shared infrastructure
    RedisModule,
    DatabaseModule,

    // BullMQ connects to the same Redis instance for job queues
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        },
      }),
      inject: [ConfigService],
    }),

    // In-process domain event bus for cross-module communication
    // (e.g. AppointmentBooked -> SMS confirmation)
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      // Event handler failures are isolated — a notification handler throwing
      // must NOT crash the booking service
      ignoreErrors: true,
    }),

    // Rate limiting backed by Redis for distributed consistency
    ThrottlerModule.forRootAsync({
      useFactory: (redis: Redis) => ({
        storage: new ThrottlerStorageRedisService(redis),
        throttlers: [{ ttl: 60_000, limit: 100 }], // ttl in ms (v5+)
      }),
      inject: [REDIS_CLIENT],
    }),

    // Feature modules
    AuthModule,
    DoctorsModule,
    AppointmentsModule,
    SchedulingModule,
    NotificationsModule,
    VideoModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
