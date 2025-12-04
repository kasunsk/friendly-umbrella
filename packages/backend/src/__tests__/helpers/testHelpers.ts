import { Response } from 'supertest';

/**
 * Helper to extract error message from API response
 */
export function getErrorMessage(res: Response): string {
  if (res.body?.error?.message) {
    return res.body.error.message;
  }
  if (res.body?.message) {
    return res.body.message;
  }
  if (res.body?.errors && Array.isArray(res.body.errors)) {
    return res.body.errors.map((e: { msg?: string; message?: string }) => e.msg || e.message || '').join(', ');
  }
  return 'Unknown error';
}

/**
 * Helper to wait for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate random string for testing
 */
export function randomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Generate random email for testing
 */
export function randomEmail(): string {
  return `test-${randomString(8)}@test.com`;
}

/**
 * Generate random UUID-like string
 */
export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


