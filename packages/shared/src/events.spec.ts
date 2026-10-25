import { describe, expect, it } from 'vitest';
import { EventBatchSchema, WebVitalEventSchema } from './events.js';

const validEvent = {
  clientEventId: '3f1c9a52-7d4e-4b1a-9c3e-2a6f8d0b5e71',
  metric: 'LCP',
  value: 2100,
  path: '/products/42',
  deviceType: 'mobile',
};

function issuePaths(input: unknown): string[] {
  const result = WebVitalEventSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('WebVitalEventSchema', () => {
  it('accepts an event with only required fields', () => {
    expect(WebVitalEventSchema.parse(validEvent)).toEqual(validEvent);
  });

  it('accepts an event with all optional fields', () => {
    const event = {
      ...validEvent,
      route: '/products/[id]',
      connectionType: '4g',
      release: '1.4.2+abc123',
      attribution: { element: 'main > img.hero', timeToFirstByte: 320 },
    };

    expect(WebVitalEventSchema.parse(event)).toEqual(event);
  });

  it('strips unknown keys such as a client-sent rating', () => {
    const parsed = WebVitalEventSchema.parse({
      ...validEvent,
      rating: 'good',
      timestamp: 123,
    });

    expect(parsed).not.toHaveProperty('rating');
    expect(parsed).not.toHaveProperty('timestamp');
  });

  it.each(['clientEventId', 'metric', 'value', 'path', 'deviceType'])(
    'requires %s',
    (field) => {
      const { [field]: _omitted, ...event } = validEvent as Record<
        string,
        unknown
      >;

      expect(issuePaths(event)).toEqual([field]);
    },
  );

  it.each([
    ['clientEventId', 'not-a-uuid'],
    ['metric', 'FID'],
    ['value', -1],
    ['value', Number.POSITIVE_INFINITY],
    ['value', Number.NaN],
    ['deviceType', 'watch'],
    ['connectionType', '5g'],
    ['path', 'products/42'],
    ['path', '/products?id=42'],
    ['path', '/products#reviews'],
    ['path', '/with space'],
    ['path', `/${'a'.repeat(512)}`],
    ['route', `/${'a'.repeat(512)}`],
    ['release', ''],
    ['release', 'r'.repeat(65)],
  ])('rejects %s = %j', (field, value) => {
    expect(issuePaths({ ...validEvent, [field]: value })).toEqual([field]);
  });

  it('accepts strings at their maximum length', () => {
    const event = {
      ...validEvent,
      path: `/${'a'.repeat(511)}`,
      route: `/${'b'.repeat(511)}`,
      release: 'r'.repeat(64),
      attribution: { ['k'.repeat(64)]: 'v'.repeat(128) },
    };

    expect(WebVitalEventSchema.safeParse(event).success).toBe(true);
  });

  it.each([
    [
      'too many keys',
      Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`k${i}`, i])),
    ],
    ['empty key', { '': 'x' }],
    ['long key', { ['k'.repeat(65)]: 'x' }],
    ['long value', { element: 'v'.repeat(129) }],
    ['nested object', { element: { tag: 'img' } }],
    ['boolean value', { cached: true }],
  ])('rejects attribution with %s', (_case, attribution) => {
    const paths = issuePaths({ ...validEvent, attribution });

    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((path) => path.startsWith('attribution'))).toBe(true);
  });
});

describe('EventBatchSchema', () => {
  const eventWithId = (n: number) => ({
    ...validEvent,
    clientEventId: `3f1c9a52-7d4e-4b1a-9c3e-${n.toString().padStart(12, '0')}`,
  });

  it('accepts 1 to 10 events', () => {
    expect(
      EventBatchSchema.safeParse({ events: [eventWithId(1)] }).success,
    ).toBe(true);
    expect(
      EventBatchSchema.safeParse({
        events: Array.from({ length: 10 }, (_, i) => eventWithId(i)),
      }).success,
    ).toBe(true);
  });

  it('rejects empty and oversized batches', () => {
    expect(EventBatchSchema.safeParse({ events: [] }).success).toBe(false);
    expect(
      EventBatchSchema.safeParse({
        events: Array.from({ length: 11 }, (_, i) => eventWithId(i)),
      }).success,
    ).toBe(false);
  });

  it('reports the index of the invalid event', () => {
    const result = EventBatchSchema.safeParse({
      events: [eventWithId(1), { ...eventWithId(2), metric: 'FID' }],
    });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ['events', 1, 'metric'],
    ]);
  });
});
