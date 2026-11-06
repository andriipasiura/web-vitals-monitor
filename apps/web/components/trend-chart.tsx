'use client';

import { METRIC_THRESHOLDS, type MetricName } from '@rum/shared';
import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { formatSamples, formatValue } from '@/lib/format';

export interface TrendPoint {
  time: string;
  value: number | null;
  count: number;
}

const HEIGHT = 240;
const INK = '#71717a';
const GRID = '#f4f4f5';
const ACCENT = '#2563eb';
const GOOD = '#15803d';
const POOR = '#dc2626';

const timeFormat = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
});

const fontFamily = () => getComputedStyle(document.body).fontFamily;

function thresholdsPlugin(metric: MetricName): uPlot.Plugin {
  const lines = [
    { value: METRIC_THRESHOLDS[metric].good, color: GOOD, label: 'good' },
    { value: METRIC_THRESHOLDS[metric].poor, color: POOR, label: 'poor' },
  ];
  return {
    hooks: {
      draw: (u) => {
        const ctx = u.ctx;
        const { left, top, width, height } = u.bbox;
        ctx.save();
        ctx.font = `${10 * devicePixelRatio}px ${fontFamily()}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        for (const line of lines) {
          const y = Math.round(u.valToPos(line.value, 'y', true));
          if (y < top || y > top + height) continue;
          ctx.strokeStyle = line.color;
          ctx.fillStyle = line.color;
          ctx.lineWidth = devicePixelRatio;
          ctx.setLineDash([4 * devicePixelRatio, 4 * devicePixelRatio]);
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(left + width, y);
          ctx.stroke();
          ctx.fillText(
            line.label,
            left + width - 4 * devicePixelRatio,
            y - 3 * devicePixelRatio,
          );
        }
        ctx.restore();
      },
    },
  };
}

function tooltipPlugin(metric: MetricName, points: TrendPoint[]): uPlot.Plugin {
  let tip: HTMLDivElement;
  return {
    hooks: {
      init: (u) => {
        tip = document.createElement('div');
        tip.className =
          'pointer-events-none absolute z-10 hidden rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs tabular-nums shadow-sm';
        u.over.appendChild(tip);
      },
      setCursor: (u) => {
        const i = u.cursor.idx;
        const point = i === null || i === undefined ? undefined : points[i];
        if (!point || u.cursor.left === undefined || u.cursor.left < 0) {
          tip.classList.add('hidden');
          return;
        }
        tip.replaceChildren();
        const value = document.createElement('div');
        value.className = 'font-medium text-zinc-900';
        value.textContent = formatValue(metric, point.value);
        const meta = document.createElement('div');
        meta.className = 'text-zinc-500';
        meta.textContent = `${timeFormat.format(new Date(point.time))} · ${formatSamples(point.count)}`;
        tip.append(value, meta);
        tip.classList.remove('hidden');
        const flip = u.cursor.left > u.over.clientWidth / 2;
        tip.style.left = `${u.cursor.left + (flip ? -tip.offsetWidth - 8 : 8)}px`;
        tip.style.top = '4px';
      },
    },
  };
}

export default function TrendChart({
  metric,
  points,
  from,
  to,
}: {
  metric: MetricName;
  points: TrendPoint[];
  from: string;
  to: string;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const values = points.map((p) => p.value);
    const max = Math.max(
      METRIC_THRESHOLDS[metric].poor * 1.1,
      ...values.map((v) => v ?? 0),
    );
    const plot = new uPlot(
      {
        width: el.clientWidth,
        height: HEIGHT,
        legend: { show: false },
        cursor: { y: false, points: { size: 8 } },
        scales: {
          x: {
            time: true,
            range: [
              new Date(from).getTime() / 1000,
              new Date(to).getTime() / 1000,
            ],
          },
          y: { range: [0, max * 1.05] },
        },
        axes: [
          {
            stroke: INK,
            grid: { show: false },
            ticks: { show: false },
            font: `11px ${fontFamily()}`,
          },
          {
            stroke: INK,
            grid: { stroke: GRID, width: 1 },
            ticks: { show: false },
            size: 56,
            font: `11px ${fontFamily()}`,
            values: (_, ticks) => ticks.map((v) => formatValue(metric, v)),
          },
        ],
        series: [
          {},
          {
            stroke: ACCENT,
            width: 2,
            spanGaps: false,
            points: { show: points.length < 3 },
          },
        ],
        plugins: [thresholdsPlugin(metric), tooltipPlugin(metric, points)],
      },
      [points.map((p) => new Date(p.time).getTime() / 1000), values],
      el,
    );
    const observer = new ResizeObserver(() =>
      plot.setSize({ width: el.clientWidth, height: HEIGHT }),
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      plot.destroy();
    };
  }, [metric, points, from, to]);

  return (
    <div
      ref={container}
      role="img"
      aria-label={`${metric} trend chart`}
      className="relative w-full"
      style={{ height: HEIGHT }}
    />
  );
}
