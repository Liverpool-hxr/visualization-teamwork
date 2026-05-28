import React, { useEffect, useMemo, useRef } from 'react';
import { Heatmap } from '@antv/g2plot';
import type { HeatmapDataPoint, ChartConfig } from '@/types/chart';
import styles from './index.module.css';

interface HeatmapChartProps {
  data: HeatmapDataPoint[];
  config?: ChartConfig;
  width?: number;
  height?: number;
}

const HeatmapChart: React.FC<HeatmapChartProps> = ({
  data,
  config = {},
  width,
  height = 400,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Heatmap | null>(null);
  const autoFit = width === undefined;
  const { minValue, maxValue } = useMemo(() => {
    if (data.length === 0) {
      return { minValue: 0, maxValue: 1 };
    }
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const item of data) {
      if (item.value < min) min = item.value;
      if (item.value > max) max = item.value;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { minValue: 0, maxValue: 1 };
    }
    if (min === max) {
      return { minValue: min, maxValue: min + 1e-6 };
    }
    return { minValue: min, maxValue: max };
  }, [data]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (chartRef.current) {
      try {
        chartRef.current.destroy();
      } catch {
        chartRef.current = null;
      }
      chartRef.current = null;
    }

    const heatmap = new Heatmap(container, {
      data,
      ...(autoFit ? { autoFit: true } : { width }),
      height,
      xField: 'x',
      yField: 'y',
      colorField: 'value',
      color: ['#316bf3', '#37a2da', '#5cd85c', '#fff433', '#ff6b6b'],
      meta: {
        x: { type: 'cat', alias: config.xAxisLabel || 'X Axis' },
        y: { type: 'cat', alias: config.yAxisLabel || 'Y Axis' },
        value: { min: minValue, max: maxValue },
      },
      tooltip:
        config.showTooltip !== false
          ? {
              formatter: (datum: unknown) => {
                const d = datum as HeatmapDataPoint;
                return {
                  name: `(${d.x}, ${d.y})`,
                  value: d.value.toFixed(4),
                };
              },
            }
          : undefined,
      legend: config.showLegend !== false ? {} : undefined,
    });

    heatmap.render();
    chartRef.current = heatmap;

    const observer = autoFit
      ? new ResizeObserver((entries) => {
          const entry = entries[0];
          const nextWidth = entry?.contentRect?.width ?? 0;
          if (nextWidth <= 0) return;
          const resizable = chartRef.current as unknown as {
            changeSize?: (w: number, h?: number) => void;
          } | null;
          resizable?.changeSize?.(nextWidth, height);
        })
      : null;

    if (observer) {
      observer.observe(container);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
      if (chartRef.current) {
        try {
          chartRef.current.destroy();
        } catch {
          chartRef.current = null;
        }
        chartRef.current = null;
      }
    };
  }, [data, config, width, height, autoFit, minValue, maxValue]);

  return (
    <div className={styles.chartContainer}>
      {config.title && <h3 className={styles.chartTitle}>{config.title}</h3>}
      <div ref={containerRef} className={styles.chartContent} />
    </div>
  );
};

export default HeatmapChart;
