import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Egységes, kiszámítható hibaformátum minden végponton (contract-barát).
 * A várt HttpException-öket a saját státuszukkal továbbengedi; a nem várt hibákat
 * 500-ként, belső részletek kiszivárogtatása NÉLKÜL adja vissza (biztonság), de logolja.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = isHttp
      ? exception.getResponse()
      : { statusCode: status, message: 'Internal server error' };

    if (!isHttp) {
      const err = exception as Error;
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${err?.message}`,
        err?.stack,
      );
    }

    const body =
      typeof payload === 'string' ? { statusCode: status, message: payload } : payload;

    response.status(status).json({
      ...body,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
