'use client';

import { METRIC_THRESHOLDS, type MetricName } from '@rum/shared';
import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { formatSamples, formatValue } from '@/lib/format';
import { cssVar, useTheme } from '@/lib/theme';

export interface TrendPoint {
  time: string;
  value: number | null;
  count: number;
}

export interface TrendMarker {
  time: string;
  label: string;
  highlight?: boolean;
}

export interface TrendSeries {
  label: string;
  points: TrendPoint[];
}

const HEIGHT = 240;
const NO_MARKERS: TrendMarker[] = [];

const timeFormat = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
});

const fontFamily = () => getComputedStyle(document.body).fontFamily;
const toSeconds = (time: string) => new Date(time).getTime() / 1000;

function yAxisScale(metric: MetricName, max: number) {
  if (metric === 'CLS') {
    return {
      incrs: [0.05, 0.1, 0.25, 0.5, 1],
      format: (v: number) => v.toFixed(2),
    };
  }
  if (max >= 3000) {
    return {
      incrs: [1000, 2000, 5000, 10000, 20000],
      format: (v: number) => `${Math.round(v / 1000)} s`,
    };
  }
  return {
    incrs: [50, 100, 200, 250, 500, 1000],
    format: (v: number) => `${Math.round(v)} ms`,
  };
}

function zonesPlugin(metric: MetricName): uPlot.Plugin {
  const { good, poor } = METRIC_THRESHOLDS[metric];
  const zones = [
    { from: 0, to: good, color: cssVar('--good'), label: 'Good' },
    { from: good, to: poor, color: cssVar('--ni'), label: 'Needs improvement' },
    { from: poor, to: Infinity, color: cssVar('--poor'), label: 'Poor' },
  ];
  return {
    hooks: {
      drawClear: (u) => {
        const ctx = u.ctx;
        const { left, width } = u.bbox;
        const px = devicePixelRatio;
        const yMax = u.scales.y!.max!;
        ctx.save();
        ctx.font = `${10 * px}px ${fontFamily()}`;
        ctx.textAlign = 'right';
        for (const zone of zones) {
          if (zone.from >= yMax) continue;
          const y1 = u.valToPos(Math.min(zone.to, yMax), 'y', true);
          const y0 = u.valToPos(zone.from, 'y', true);
          ctx.globalAlpha = 0.07;
          ctx.fillStyle = zone.color;
          ctx.fillRect(left, y1, width, y0 - y1);
          if (y0 - y1 < 14 * px) continue;
          const atTop = zone.to === Infinity;
          ctx.globalAlpha = 0.9;
          ctx.textBaseline = atTop ? 'top' : 'bottom';
          ctx.fillText(
            zone.label,
            left + width - 4 * px,
            atTop ? y1 + 3 * px : y0 - 3 * px,
          );
        }
        ctx.restore();
      },
    },
  };
}

function markersPlugin(markers: TrendMarker[]): uPlot.Plugin {
  const muted = cssVar('--muted');
  const faint = cssVar('--faint');
  const poor = cssVar('--poor');
  return {
    hooks: {
      draw: (u) => {
        const ctx = u.ctx;
        const { left, top, width, height } = u.bbox;
        const px = devicePixelRatio;
        ctx.save();
        ctx.font = `${10 * px}px ${fontFamily()}`;
        ctx.textBaseline = 'top';
        ctx.lineWidth = px;
        for (const marker of markers) {
          const x = Math.round(u.valToPos(toSeconds(marker.time), 'x', true));
          if (x <= left || x >= left + width) continue;
          ctx.strokeStyle = marker.highlight ? poor : faint;
          ctx.fillStyle = marker.highlight ? poor : muted;
          ctx.setLineDash([2 * px, 3 * px]);
          ctx.beginPath();
          ctx.moveTo(x, top);
          ctx.lineTo(x, top + height);
          ctx.stroke();
          const flip =
            x + ctx.measureText(marker.label).width + 8 * px > left + width;
          ctx.textAlign = flip ? 'right' : 'left';
          ctx.fillText(marker.label, x + (flip ? -4 : 4) * px, top + 2 * px);
        }
        ctx.restore();
      },
    },
  };
}

function tooltipPlugin(
  metric: MetricName,
  rows: { label: string; byTime: Map<number, TrendPoint> }[],
): uPlot.Plugin {
  let tip: HTMLDivElement;
  return {
    hooks: {
      init: (u) => {
        tip = document.createElement('div');
        tip.className =
          'pointer-events-none absolute z-10 hidden rounded-md border border-line bg-surface px-2 py-1 text-xs tabular-nums shadow-sm';
        u.over.appendChild(tip);
      },
      setCursor: (u) => {
        const i = u.cursor.idx;
        const time = i === null || i === undefined ? undefined : u.data[0][i];
        const main = time === undefined ? undefined : rows[0]!.byTime.get(time);
        if (!main || u.cursor.left === undefined || u.cursor.left < 0) {
          tip.classList.add('hidden');
          return;
        }
        tip.replaceChildren();
        for (const [index, row] of rows.entries()) {
          const point = row.byTime.get(time!);
          const line = document.createElement('div');
          line.className = index === 0 ? 'font-medium text-fg' : 'text-muted';
          line.textContent = `${rows.length > 1 ? `${row.label} ` : ''}${formatValue(metric, point?.value)}`;
          tip.append(line);
        }
        const meta = document.createElement('div');
        meta.className = 'text-muted';
        meta.textContent = `${timeFormat.format(new Date(main.time))} · ${formatSamples(main.count)}`;
        tip.append(meta);
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
  label = 'All routes',
  secondary,
  markers = NO_MARKERS,
}: {
  metric: MetricName;
  points: TrendPoint[];
  from: string;
  label?: string;
  secondary?: TrendSeries;
  markers?: TrendMarker[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const series = [{ label, points }, ...(secondary ? [secondary] : [])];
    const tables = series.map(
      (s) =>
        [
          s.points.map((p) => toSeconds(p.time)),
          s.points.map((p) => p.value),
        ] as uPlot.AlignedData,
    );
    const data = tables.length > 1 ? uPlot.join(tables) : tables[0]!;
    const values = series.flatMap((s) => s.points.map((p) => p.value ?? 0));
    const max = Math.max(METRIC_THRESHOLDS[metric].poor * 1.1, ...values);
    const axis = yAxisScale(metric, max);
    const last = points.at(-1);
    const xMax = last ? toSeconds(last.time) : Date.now() / 1000;
    const ink = cssVar('--muted');
    const grid = cssVar('--line');

    const plot = new uPlot(
      {
        width: el.clientWidth,
        height: HEIGHT,
        legend: { show: false },
        cursor: { y: false, points: { size: 7 } },
        scales: {
          x: { time: true, range: [toSeconds(from), xMax] },
          y: { range: [0, max * 1.05] },
        },
        axes: [
          {
            stroke: ink,
            grid: { show: false },
            ticks: { show: false },
            font: `11px ${fontFamily()}`,
          },
          {
            stroke: ink,
            grid: { stroke: grid, width: 1, dash: [2, 4] },
            ticks: { show: false },
            size: 52,
            font: `11px ${fontFamily()}`,
            incrs: axis.incrs,
            values: (_, ticks) => ticks.map(axis.format),
          },
        ],
        series: [
          {},
          {
            stroke: cssVar('--accent'),
            width: 2,
            spanGaps: false,
            points: { show: points.length < 3 },
          },
          ...(secondary
            ? [
                {
                  stroke: cssVar('--faint'),
                  width: 1.5,
                  spanGaps: false,
                  points: { show: false },
                },
              ]
            : []),
        ],
        plugins: [
          zonesPlugin(metric),
          markersPlugin(markers),
          tooltipPlugin(
            metric,
            series.map((s) => ({
              label: s.label,
              byTime: new Map(s.points.map((p) => [toSeconds(p.time), p])),
            })),
          ),
        ],
      },
      data,
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
  }, [metric, points, from, label, secondary, markers, isDark]);

  return (
    <div
      ref={container}
      role="img"
      aria-label={`${metric} trend for ${label}${secondary ? ` and ${secondary.label}` : ''}`}
      className="relative w-full"
      style={{ height: HEIGHT }}
    />
  );
}
