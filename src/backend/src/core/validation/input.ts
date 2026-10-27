import { AppError } from '../errors/app-error';

export function requiredString(value: unknown, field: string, max = 255): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new AppError('INVALID_INPUT', `${field} is invalid.`);
  }
  return value.trim();
}

export function positiveInteger(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new AppError('INVALID_INPUT', `${field} must be a positive integer.`);
  return n;
}
