import type { Rating, WebVitalEvent } from '@rum/shared';

export const EVENTS_REPOSITORY = Symbol('EVENTS_REPOSITORY');

export type RouteSource = 'sdk' | 'server';

export type StoredEvent = WebVitalEvent & {
  projectId: string;
  route: string;
  routeSource: RouteSource;
  rating: Rating;
  receivedAt: Date;
};

export interface EventsRepository {
  saveMany(events: readonly StoredEvent[]): Promise<void>;
}
