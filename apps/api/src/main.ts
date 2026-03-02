import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import basicAuth from 'express-basic-auth';
import { AppModule } from './app.module';
import { ResponseEnvelopeInterceptor } from './shared/interceptors/response.interceptor';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Security headers
  app.use(helmet());

  // Required to read the httpOnly refresh_token cookie on POST /auth/refresh
  app.use(cookieParser());

  // CORS — restrict to known frontend origins, credentials: true allows
  // the browser to send httpOnly cookies cross-origin
  app.enableCors({
    origin: [
      config.get<string>('FRONTEND_URL', 'http://localhost:5173'),
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Validation: whitelist strips unknown properties, transform enables
  // auto-transformation of payloads to DTO instances
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // All API routes under /api/v1
  app.setGlobalPrefix('api/v1');

  // Password-protected BullMQ admin dashboard
  // Queues are registered here once created (Phase 5)
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  createBullBoard({ queues: [], serverAdapter });
  app.use(
    '/admin/queues',
    basicAuth({
      users: {
        admin: config.get<string>('BULL_BOARD_PASSWORD', 'changeme'),
      },
      challenge: true,
    }),
    serverAdapter.getRouter(),
  );

  // Health check outside /api/v1 prefix so it stays at /health
  app.getHttpAdapter().get('/health', (_req: any, res: any) => {
    res.json({
      success: true,
      data: { status: 'ok', uptime: process.uptime() },
    });
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`API listening on port ${port}`);
}
bootstrap();
