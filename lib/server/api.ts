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
  const body = JSON.stringify({ success: true, data }, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function errorResponse(error: ApiError | Error) {
  if (error instanceof ApiError) {
    logger.warn('API error response', { statusCode: error.statusCode, code: error.code, message: error.message });

    return new Response(
      JSON.stringify(
        {
          success: false,
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
          },
        },
        (_, value) => (typeof value === 'bigint' ? value.toString() : value),
      ),
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
