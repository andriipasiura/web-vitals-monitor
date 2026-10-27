import { describe, expect, it } from 'vitest';
import { AUTH_LIMITS, LoginSchema, RegisterSchema } from './auth.js';

describe('RegisterSchema', () => {
  const valid = { email: 'dev@example.com', password: 'correct-horse' };

  it('trims and lowercases the email', () => {
    expect(
      RegisterSchema.parse({ ...valid, email: '  Dev@Example.COM ' }).email,
    ).toBe('dev@example.com');
  });

  it.each([
    { email: 'not-an-email' },
    { password: 'x'.repeat(AUTH_LIMITS.minPasswordLength - 1) },
    { password: 'x'.repeat(AUTH_LIMITS.maxPasswordLength + 1) },
  ])('rejects %j', (override) => {
    expect(RegisterSchema.safeParse({ ...valid, ...override }).success).toBe(
      false,
    );
  });
});

describe('LoginSchema', () => {
  it('accepts passwords shorter than the registration minimum', () => {
    expect(
      LoginSchema.safeParse({ email: 'dev@example.com', password: 'short' })
        .success,
    ).toBe(true);
  });
});
