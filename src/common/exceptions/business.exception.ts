import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * Custom business exceptions with standardized error codes
 * Used throughout the application for consistent error handling
 */

export class DuplicateResourceException extends ConflictException {
  constructor(resource: string, identifier: string, field?: string) {
    super({
      success: false,
      error: {
        code: 'DUPLICATE_RESOURCE',
        message: `${resource} dengan ${field || 'identifier'} ${identifier} sudah ada`,
      },
    });
  }
}

export class ResourceNotFoundException extends NotFoundException {
  constructor(resource: string, identifier: string | number) {
    super({
      success: false,
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: `${resource} dengan ID ${identifier} tidak ditemukan`,
      },
    });
  }
}

export class InvalidStatusTransitionException extends BadRequestException {
  constructor(from: string, to: string, allowedTransitions: string[]) {
    super({
      success: false,
      error: {
        code: 'INVALID_STATUS_TRANSITION',
        message: `Tidak bisa mengubah status dari ${from} ke ${to}`,
        details: [{ allowedTransitions }],
      },
    });
  }
}

export class InsufficientStockException extends UnprocessableEntityException {
  constructor(medicationName: string, available: number, requested: number) {
    super({
      success: false,
      error: {
        code: 'INSUFFICIENT_STOCK',
        message: `Stok ${medicationName} tidak mencukupi`,
        details: [{ available, requested }],
      },
    });
  }
}

export class SatusehatSyncException extends ServiceUnavailableException {
  constructor(resource: string, localId: number, errorMessage: string) {
    super({
      success: false,
      error: {
        code: 'SATUSEHAT_SYNC_FAILED',
        message: 'Gagal sinkronisasi ke SATUSEHAT',
        details: [{ resource, localId, reason: errorMessage }],
      },
    });
  }
}

export class UnauthorizedAccessException extends BadRequestException {
  constructor(message: string = 'Anda tidak memiliki akses ke resource ini') {
    super({
      success: false,
      error: {
        code: 'UNAUTHORIZED_ACCESS',
        message,
      },
    });
  }
}

export class ValidationException extends BadRequestException {
  constructor(field: string, message: string) {
    super({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Data tidak valid',
        details: [{ field, message }],
      },
    });
  }
}
