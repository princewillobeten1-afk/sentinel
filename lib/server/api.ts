import { ApiError } from './errors';
import { logger } from './logger';

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
};

export function jsonResponse<T>(data: T, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function errorResponse(error: ApiError | Error) {
  if (error instanceof ApiError) {
    logger.warn('API error response', { statusCode: error.statusCode, code: error.code, message: error.message });

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
      }),
      {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  logger.error('Unhandled API error', { message: error instanceof Error ? error.message : String(error) });

  return new Response(
    JSON.stringify({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
