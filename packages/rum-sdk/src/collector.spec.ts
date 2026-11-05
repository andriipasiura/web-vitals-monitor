import { EVENT_LIMITS, EventBatchSchema, type MetricName } from '@rum/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RumConfig } from './collector.js';

interface TestMetric {
  name: string;
  value: number;
  attribution: Record<string, unknown>;
}

const callbacks = vi.hoisted(
  () => new Map<string, (metric: TestMetric) => void>(),
);

vi.mock('web-vitals/attribution', () => {
  const register = (name: string) => (cb: (metric: TestMetric) => void) =>
    callbacks.set(name, cb);
  return {
    onCLS: register('CLS'),
    onFCP: register('FCP'),
    onINP: register('INP'),
    onLCP: register('LCP'),
    onTTFB: register('TTFB'),
  };
});

const config: RumConfig = { key: 'pk_test', endpoint: 'http://api.test/' };
const url = 'http://api.test/v1/events?key=pk_test';

let sendBeacon: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

async function init(overrides: Partial<RumConfig> = {}) {
  vi.resetModules();
  const { initRum } = await import('./collector.js');
  initRum({ ...config, ...overrides });
  return initRum;
}

function report(
  metric: MetricName,
  value = 100,
  attribution: Record<string, unknown> = {},
) {
  callbacks.get(metric)!({ name: metric, value, attribution });
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

function sentBatches() {
  return sendBeacon.mock.calls.map(([target, body]) => {
    expect(target).toBe(url);
    return EventBatchSchema.parse(JSON.parse(body as string)).events;
  });
}

beforeEach(() => {
  callbacks.clear();
  history.replaceState(null, '', '/products/42?ref=mail#top');
  sendBeacon = vi.fn(() => true);
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: sendBeacon,
  });
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  setVisibility('visible');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('payload', () => {
  it('sends events matching the ingestion schema', async () => {
    await init({ release: 'v1.2.3', route: '/products/[id]' });
    report('LCP', 2100);
    dispatchEvent(new Event('pagehide'));

    const [events] = sentBatches();
    expect(events).toEqual([
      {
        clientEventId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        metric: 'LCP',
        value: 2100,
        path: '/products/42',
        route: '/products/[id]',
        deviceType: 'desktop',
        release: 'v1.2.3',
      },
    ]);
  });

  it('gives every event its own clientEventId', async () => {
    await init();
    report('LCP');
    report('CLS');
    dispatchEvent(new Event('pagehide'));

    const [events] = sentBatches();
    expect(new Set(events!.map((e) => e.clientEventId)).size).toBe(2);
  });

  it('reports a known connection type and ignores others', async () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { effectiveType: '3g' },
    });
    await init();
    report('TTFB');
    dispatchEvent(new Event('pagehide'));
    expect(sentBatches()[0]![0]!.connectionType).toBe('3g');

    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { effectiveType: '5g' },
    });
    await init();
    report('TTFB');
    dispatchEvent(new Event('pagehide'));
    expect(sentBatches().at(-1)![0]).not.toHaveProperty('connectionType');
    Reflect.deleteProperty(navigator, 'connection');
  });

  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile', 'mobile'],
    ['Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile Safari', 'mobile'],
    ['Mozilla/5.0 (Linux; Android 15; SM-X910) Safari', 'tablet'],
    ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 'tablet'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140', 'desktop'],
  ])('detects device type from %s', async (userAgent, deviceType) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    await init();
    report('FCP');
    dispatchEvent(new Event('pagehide'));
    expect(sentBatches()[0]![0]!.deviceType).toBe(deviceType);
  });
});

describe('attribution', () => {
  it('keeps only selectors, URLs without query and phase durations', async () => {
    await init();
    report('LCP', 2100, {
      target: 'main > img.hero',
      url: 'https://cdn.test/hero.jpg?token=secret#x',
      timeToFirstByte: 300,
      resourceLoadDelay: 100,
      resourceLoadDuration: 900,
      elementRenderDelay: 50,
      lcpEntry: { startTime: 2100 },
      navigationEntry: {},
    });
    report('INP', 250, {
      interactionTarget: 'button#buy',
      interactionType: 'pointer',
      inputDelay: 10,
      processingDuration: 200,
      presentationDelay: 40,
      loadState: 'complete',
      longAnimationFrameEntries: [],
    });
    report('CLS', 0.2, {
      largestShiftTarget: 'div.ad',
      largestShiftValue: 0.2,
    });
    dispatchEvent(new Event('pagehide'));

    expect(sentBatches()[0]!.map((e) => e.attribution)).toEqual([
      {
        target: 'main > img.hero',
        url: 'https://cdn.test/hero.jpg',
        timeToFirstByte: 300,
        resourceLoadDelay: 100,
        resourceLoadDuration: 900,
        elementRenderDelay: 50,
      },
      {
        interactionTarget: 'button#buy',
        inputDelay: 10,
        processingDuration: 200,
        presentationDelay: 40,
      },
      { largestShiftTarget: 'div.ad' },
    ]);
  });

  it('omits missing, empty and non-finite values', async () => {
    await init();
    report('CLS', 0, { largestShiftTarget: '' });
    report('TTFB', 0, { waitingDuration: Number.NaN, dnsDuration: 5 });
    dispatchEvent(new Event('pagehide'));

    const [cls, ttfb] = sentBatches()[0]!;
    expect(cls).not.toHaveProperty('attribution');
    expect(ttfb!.attribution).toEqual({ dnsDuration: 5 });
  });
});

describe('truncation', () => {
  it('truncates attribution values to the shared limit', async () => {
    await init();
    report('INP', 100, { interactionTarget: 'x'.repeat(500) });
    dispatchEvent(new Event('pagehide'));
    expect(sentBatches()[0]![0]!.attribution!.interactionTarget).toHaveLength(
      EVENT_LIMITS.maxAttributionValueLength,
    );
  });

  it('truncates path, route and release to the shared limits', async () => {
    history.replaceState(null, '', `/${'p'.repeat(600)}`);
    await init({ route: `/${'r'.repeat(600)}?q=1`, release: 'x'.repeat(100) });
    report('INP');
    dispatchEvent(new Event('pagehide'));

    const event = sentBatches()[0]![0]!;
    expect(event.path).toHaveLength(EVENT_LIMITS.maxPathLength);
    expect(event.route).toHaveLength(EVENT_LIMITS.maxRouteLength);
    expect(event.release).toHaveLength(EVENT_LIMITS.maxReleaseLength);
  });

  it('strips the query string from the route', async () => {
    await init({ route: '/search?q=shoes#results' });
    report('INP');
    dispatchEvent(new Event('pagehide'));
    expect(sentBatches()[0]![0]!.route).toBe('/search');
  });

  it.each(['search', '/with space', ''])(
    'omits an invalid route %j',
    async (route) => {
      await init({ route, release: '' });
      report('INP');
      dispatchEvent(new Event('pagehide'));
      const event = sentBatches()[0]![0]!;
      expect(event).not.toHaveProperty('route');
      expect(event).not.toHaveProperty('release');
    },
  );
});

describe('batching and flush', () => {
  it('sends a full batch as soon as it reaches the limit', async () => {
    await init();
    for (let i = 0; i < EVENT_LIMITS.maxEventsPerBatch; i++) report('CLS', i);

    const batches = sentBatches();
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(EVENT_LIMITS.maxEventsPerBatch);
  });

  it('flushes the rest when the page becomes hidden', async () => {
    await init();
    for (let i = 0; i <= EVENT_LIMITS.maxEventsPerBatch; i++) report('CLS', i);
    expect(sendBeacon).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    expect(sendBeacon).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    expect(sentBatches().map((events) => events.length)).toEqual([10, 1]);
  });

  it('does not send an empty batch', async () => {
    await init();
    setVisibility('hidden');
    dispatchEvent(new Event('pagehide'));
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends each event only once', async () => {
    await init();
    report('LCP');
    setVisibility('hidden');
    dispatchEvent(new Event('pagehide'));
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('sends the body as text/plain', async () => {
    await init();
    report('LCP');
    dispatchEvent(new Event('pagehide'));
    expect(typeof sendBeacon.mock.calls[0]![1]).toBe('string');
  });

  it.each([
    ['returns false', () => false],
    [
      'throws',
      () => {
        throw new TypeError('blocked');
      },
    ],
  ])(
    'falls back to fetch with keepalive when sendBeacon %s',
    async (_, impl) => {
      sendBeacon.mockImplementation(impl);
      await init();
      report('LCP');
      dispatchEvent(new Event('pagehide'));

      expect(fetchMock).toHaveBeenCalledWith(url, {
        method: 'POST',
        body: sendBeacon.mock.calls[0]![1],
        keepalive: true,
      });
    },
  );

  it('drops the batch when fetch fails', async () => {
    sendBeacon.mockReturnValue(false);
    fetchMock.mockRejectedValue(new TypeError('offline'));
    await init();
    report('LCP');
    dispatchEvent(new Event('pagehide'));
    await Promise.resolve();

    report('CLS');
    dispatchEvent(new Event('pagehide'));
    const bodies = fetchMock.mock.calls.map(
      ([, options]) =>
        JSON.parse((options as RequestInit).body as string).events,
    );
    expect(
      bodies.map((events) => events.map((e: { metric: string }) => e.metric)),
    ).toEqual([['LCP'], ['CLS']]);
  });
});

describe('sampling', () => {
  it('collects nothing when the page load is not sampled', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await init({ sampleRate: 0.4 });
    expect(callbacks.size).toBe(0);
  });

  it('collects when the page load is sampled', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await init({ sampleRate: 0.6 });
    expect([...callbacks.keys()].sort()).toEqual([
      'CLS',
      'FCP',
      'INP',
      'LCP',
      'TTFB',
    ]);
  });

  it('defaults to collecting every page load', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    await init();
    expect(callbacks.size).toBe(5);
  });

  it('decides once per page load', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const initRum = await init({ sampleRate: 0 });
    initRum({ ...config, sampleRate: 1 });
    expect(callbacks.size).toBe(0);
  });
});
