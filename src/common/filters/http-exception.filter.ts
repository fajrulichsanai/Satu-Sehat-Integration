import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Global HTTP Exception Filter
 * Standardizes error responses according to API_SPEC.md format:
 * {
 *   success: false,
 *   error: {
 *     code: string,
 *     message: string,
 *     details?: any[]
 *   }
 * }
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Handle custom exceptions with error codes
    if (
      typeof exceptionResponse === 'object' &&
      'success' in exceptionResponse
    ) {
      // Custom exception already formatted
      return response.status(status).json(exceptionResponse);
    }

    // Handle standard NestJS exceptions
    const errorResponse =
      typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : (exceptionResponse as any);

    const errorCode = this.getErrorCode(status);
    const message = Array.isArray(errorResponse.message)
      ? errorResponse.message[0]
      : errorResponse.message || exception.message;

    const standardizedError = {
      success: false,
      error: {
        code: errorCode,
        message: message,
        ...(Array.isArray(errorResponse.message) && {
          details: errorResponse.message.map((msg) => ({
            field: this.extractField(msg),
            message: msg,
          })),
        }),
      },
    };

    response.status(status).json(standardizedError);
  }

  private getErrorCode(status: number): string {
    const errorCodeMap: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      500: 'INTERNAL_SERVER_ERROR',
    };

    return errorCodeMap[status] || 'UNKNOWN_ERROR';
  }

  private extractField(message: string): string {
    // Extract field name from validation messages like "email must be an email"
    const match = message.match(/^(\w+)\s/);
    return match ? match[1] : 'unknown';
  }
}
