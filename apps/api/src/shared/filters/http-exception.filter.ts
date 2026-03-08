import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const code =
      typeof exceptionResponse === 'object' && 'code' in exceptionResponse
        ? (exceptionResponse as any).code
        : `HTTP_${status}`;
    const message =
      typeof exceptionResponse === 'object' && 'message' in exceptionResponse
        ? (exceptionResponse as any).message
        : exception.message;

    this.logger.warn(`${request.method} ${request.url} → ${status}: ${code}`);

    response.status(status).json({
      success: false,
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        request_id: (request as any).requestId ?? null,
      },
      error: { code, message },
    });
  }
}
