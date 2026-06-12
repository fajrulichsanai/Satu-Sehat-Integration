export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  meta?: PaginationMeta;
  errors?: string[];

  static success<T>(data: T, message = 'Berhasil'): ApiResponse<T> {
    return { success: true, message, data };
  }

  static error<T = null>(message: string, errors?: string[]): ApiResponse<T> {
    return { success: false, message, data: null, errors };
  }

  static paginated<T>(
    data: T[],
    meta: PaginationMeta,
    message = 'Berhasil',
  ): ApiResponse<T[]> {
    return { success: true, message, data, meta };
  }
}
