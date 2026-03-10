import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '@/app.module';
import { ResponseEnvelopeInterceptor } from '@/shared/interceptors/response.interceptor';
import { HttpExceptionFilter } from '@/shared/filters/http-exception.filter';

export interface TestApp {
  app: INestApplication;
  /** Pre-configured supertest agent bound to the app's HTTP server */
  agent: ReturnType<typeof request>;
}

/**
 * Bootstraps the full NestJS application for integration tests,
 * applying the same global pipes, interceptors and filters as main.ts.
 *
 * Usage:
 *   let testApp: TestApp;
 *   beforeAll(async () => { testApp = await createTestApp(); });
 *   afterAll(async () => { await testApp.app.close(); });
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api/v1');

  await app.init();

  const agent = request(app.getHttpServer() as Server);

  return { app, agent };
}
