import { describe, expect, it } from 'vitest';
import {
  CreateProjectSchema,
  OriginSchema,
  PROJECT_LIMITS,
  UpdateProjectSchema,
} from './projects.js';

describe('OriginSchema', () => {
  it.each([
    ['https://shop.example/', 'https://shop.example'],
    ['HTTPS://Shop.Example:443', 'https://shop.example'],
    [' http://localhost:3000 ', 'http://localhost:3000'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(OriginSchema.parse(input)).toBe(expected);
  });

  it.each([
    'shop.example',
    'null',
    'ftp://shop.example',
    'https://shop.example/path',
    'https://shop.example?q=1',
    'https://shop.example#top',
    'https://user:pass@shop.example',
  ])('rejects %j', (input) => {
    expect(OriginSchema.safeParse(input).success).toBe(false);
  });
});

describe('CreateProjectSchema', () => {
  it('defaults origins to [] and removes duplicates', () => {
    expect(CreateProjectSchema.parse({ name: 'Shop' }).allowedOrigins).toEqual(
      [],
    );
    expect(
      CreateProjectSchema.parse({
        name: 'Shop',
        allowedOrigins: ['https://shop.example', 'HTTPS://shop.example/'],
      }).allowedOrigins,
    ).toEqual(['https://shop.example']);
  });

  it('enforces name and origin limits', () => {
    const origins = Array.from(
      { length: PROJECT_LIMITS.maxAllowedOrigins + 1 },
      (_, i) => `https://s${i}.example`,
    );
    expect(CreateProjectSchema.safeParse({ name: ' ' }).success).toBe(false);
    expect(
      CreateProjectSchema.safeParse({ name: 'Shop', allowedOrigins: origins })
        .success,
    ).toBe(false);
  });
});

describe('UpdateProjectSchema', () => {
  it('requires at least one field', () => {
    expect(UpdateProjectSchema.safeParse({}).success).toBe(false);
    expect(UpdateProjectSchema.safeParse({ name: 'New' }).success).toBe(true);
  });
});
