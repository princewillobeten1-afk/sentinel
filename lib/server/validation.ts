import { z, ZodError, ZodSchema } from 'zod';
import { ApiError } from './errors';

export async function parseJsonBody(request: Request) {
  const text = await request.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ApiError('Invalid JSON body', 400, 'INVALID_JSON');
  }
}

export function validateSchema<T>(schema: ZodSchema<T>, payload: unknown): T {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new ApiError('Request validation failed', 422, 'VALIDATION_ERROR', result.error.format());
  }

  return result.data;
}

export const emailSchema = z.string().email();
export const passwordSchema = z.string().min(8);
