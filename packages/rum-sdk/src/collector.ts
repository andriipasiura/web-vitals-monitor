import type {
  Attribution,
  ConnectionType,
  DeviceType,
  EventBatch,
  MetricName,
  WebVitalEvent,
} from '@rum/shared';
import {
  CONNECTION_TYPES,
  EVENT_LIMITS,
  PATH_PATTERN,
} from '@rum/shared/limits';
import {
  onCLS,
  onFCP,
  onINP,
  onLCP,
  onTTFB,
  type MetricWithAttribution,
} from 'web-vitals/attribution';

export interface RumConfig {
  key: string;
  endpoint: string;
  release?: string;
  route?: string;
  sampleRate?: number;
}

const ATTRIBUTION_KEYS: Record<MetricName, string[]> = {
  LCP: [
    'target',
    'url',
    'timeToFirstByte',
    'resourceLoadDelay',
    'resourceLoadDuration',
    'elementRenderDelay',
  ],
  INP: [
    'interactionTarget',
    'inputDelay',
    'processingDuration',
    'presentationDelay',
  ],
  CLS: ['largestShiftTarget'],
  TTFB: [
    'waitingDuration',
    'cacheDuration',
    'dnsDuration',
    'connectionDuration',
    'requestDuration',
  ],
  FCP: ['timeToFirstByte', 'firstByteToFCP'],
};

let started = false;

export function initRum(config: RumConfig): void {
  if (started) return;
  started = true;
  if (!(Math.random() < (config.sampleRate ?? 1))) return;
  if (!globalThis.crypto?.randomUUID) return;

  const url = `${config.endpoint.replace(/\/+$/, '')}/v1/events?key=${encodeURIComponent(config.key)}`;
  const route = config.route
    ?.split(/[?#]/)[0]
    ?.slice(0, EVENT_LIMITS.maxRouteLength);
  const release = config.release?.slice(0, EVENT_LIMITS.maxReleaseLength);
  const context = {
    path: location.pathname.slice(0, EVENT_LIMITS.maxPathLength),
    route: route && PATH_PATTERN.test(route) ? route : undefined,
    deviceType: getDeviceType(),
    connectionType: getConnectionType(),
    release: release || undefined,
  };

  let queue: WebVitalEvent[] = [];

  const flush = () => {
    if (!queue.length) return;
    const body = JSON.stringify({ events: queue } satisfies EventBatch);
    queue = [];
    let queued = false;
    try {
      queued = navigator.sendBeacon(url, body);
    } catch {}
    if (!queued) {
      fetch(url, { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  };

  const report = (metric: MetricWithAttribution) => {
    queue.push({
      clientEventId: crypto.randomUUID(),
      metric: metric.name,
      value: metric.value,
      ...context,
      attribution: summarizeAttribution(metric),
    } satisfies WebVitalEvent);
    if (queue.length >= EVENT_LIMITS.maxEventsPerBatch) flush();
  };

  onCLS(report);
  onFCP(report);
  onINP(report);
  onLCP(report);
  onTTFB(report);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  addEventListener('pagehide', flush);
}

function summarizeAttribution(
  metric: MetricWithAttribution,
): Attribution | undefined {
  const source = metric.attribution as unknown as Record<string, unknown>;
  const summary: Attribution = {};
  for (const key of ATTRIBUTION_KEYS[metric.name]) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      summary[key] = value;
    } else if (typeof value === 'string' && value) {
      summary[key] = (key === 'url' ? value.split(/[?#]/)[0]! : value).slice(
        0,
        EVENT_LIMITS.maxAttributionValueLength,
      );
    }
  }
  return Object.keys(summary).length ? summary : undefined;
}

function getDeviceType(): DeviceType {
  const ua = navigator.userAgent;
  if (
    /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  ) {
    return 'tablet';
  }
  return /Mobi|iPhone|Android/i.test(ua) ? 'mobile' : 'desktop';
}

function getConnectionType(): ConnectionType | undefined {
  const type = (navigator as { connection?: { effectiveType?: string } })
    .connection?.effectiveType;
  return CONNECTION_TYPES.find((allowed) => allowed === type);
}
