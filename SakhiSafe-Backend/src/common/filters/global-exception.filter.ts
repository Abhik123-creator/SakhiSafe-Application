import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const { statusCode, code, message } = this.resolveError(exception);

    const body: Record<string, unknown> = {
      success: false,
      error: { code, message },
      requestId: request.requestId,
    };

    if (this.configService.get<string>('app.nodeEnv') !== 'production' && exception instanceof Error) {
      body.debug = { name: exception.name };
    }

    response.status(statusCode).json(body);
  }

  private resolveError(exception: unknown): { statusCode: number; code: string; message: string } {
    if (exception instanceof BadRequestException) {
      return { statusCode: HttpStatus.BAD_REQUEST, code: 'VALIDATION_ERROR', message: 'The request is invalid.' };
    }
    if (exception instanceof UnauthorizedException) {
      return { statusCode: HttpStatus.UNAUTHORIZED, code: 'UNAUTHORIZED', message: 'Authentication is required.' };
    }
    if (exception instanceof ForbiddenException) {
      return { statusCode: HttpStatus.FORBIDDEN, code: 'FORBIDDEN', message: 'You do not have permission.' };
    }
    if (exception instanceof NotFoundException) {
      return { statusCode: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'The requested resource was not found.' };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { statusCode: HttpStatus.CONFLICT, code: 'CONFLICT', message: 'A record already exists.' };
      }
      if (exception.code === 'P2025') {
        return { statusCode: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'The requested resource was not found.' };
      }
      return { statusCode: HttpStatus.BAD_REQUEST, code: 'DATABASE_ERROR', message: 'The request could not be processed.' };
    }
    if (exception instanceof HttpException) {
      return {
        statusCode: exception.getStatus(),
        code: 'HTTP_ERROR',
        message: 'The request could not be processed.',
      };
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong.',
    };
  }
}
