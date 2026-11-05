import { initRum } from './collector.js';

const data = (document.currentScript as HTMLScriptElement | null)?.dataset;

if (data?.key && data.endpoint) {
  initRum({
    key: data.key,
    endpoint: data.endpoint,
    release: data.release,
    sampleRate: data.sampleRate ? Number(data.sampleRate) : undefined,
  });
}
