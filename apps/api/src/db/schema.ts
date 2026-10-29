import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('users_email_uq').on(t.email),
    check('users_email_lowercase', sql`${t.email} = lower(${t.email})`),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    replacedBy: uuid('replaced_by').references(
      (): AnyPgColumn => refreshTokens.id,
    ),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('refresh_tokens_hash_uq').on(t.tokenHash),
    index('refresh_tokens_family_idx').on(t.familyId),
    index('refresh_tokens_user_idx').on(t.userId),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    allowedOrigins: text('allowed_origins')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('projects_owner_idx').on(t.ownerId)],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    keyHash: text('key_hash').notNull(),
    prefix: text('prefix').notNull(),
    createdAt: createdAt(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('api_keys_hash_uq').on(t.keyHash),
    index('api_keys_project_idx').on(t.projectId),
  ],
);

export const events = pgTable(
  'events',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity(),
    projectId: uuid('project_id').notNull(),
    metric: text('metric').notNull(),
    value: doublePrecision('value').notNull(),
    rating: text('rating').notNull(),
    path: text('path').notNull(),
    route: text('route').notNull(),
    routeSource: text('route_source').notNull(),
    deviceType: text('device_type').notNull(),
    connectionType: text('connection_type'),
    release: text('release'),
    attribution: jsonb('attribution').$type<Record<string, string | number>>(),
    clientEventId: uuid('client_event_id').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    clientTimestamp: timestamp('client_timestamp', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.receivedAt] }),
    index('events_project_route_metric_idx').on(t.projectId, t.route, t.metric),
    index('events_received_at_brin').using('brin', t.receivedAt),
  ],
);

export const eventRollupsHourly = pgTable(
  'event_rollups_hourly',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    metric: text('metric').notNull(),
    route: text('route').notNull(),
    deviceType: text('device_type').notNull(),
    release: text('release'),
    hour: timestamp('hour', { withTimezone: true }).notNull(),
    count: integer('count').notNull(),
    goodCount: integer('good_count').notNull(),
    niCount: integer('ni_count').notNull(),
    poorCount: integer('poor_count').notNull(),
    sumValue: doublePrecision('sum_value').notNull(),
    buckets: integer('buckets').array().notNull(),
  },
  (t) => [
    unique('event_rollups_hourly_key')
      .on(t.projectId, t.metric, t.route, t.deviceType, t.release, t.hour)
      .nullsNotDistinct(),
    index('event_rollups_hourly_project_metric_hour_idx').on(
      t.projectId,
      t.metric,
      t.hour,
    ),
  ],
);
