import React, { useEffect, useRef } from 'react';
import { Line } from '@antv/g2plot';
import type { FunnelData, ChartConfig } from '@/types/chart';
import styles from './index.module.css';

interface FunnelChartProps {
  data: FunnelData;
  config?: ChartConfig;
  width?: number;
  height?: number;
}

const FunnelChart: React.FC<FunnelChartProps> = ({
  data,
  config = {},
  width,
  height = 400,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Line | null>(null);
  const autoFit = width === undefined;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data) return;

    if (chartRef.current) {
      try {
        const chartContainer = (chartRef.current as unknown as { container?: HTMLElement }).container;
        if (chartContainer && chartContainer.parentNode) {
          chartRef.current.destroy();
        }
      } catch {
        // Chart container may already be removed
      }
      chartRef.current = null;
    }

    const rankData = data.layers.map((layer) => ({
      layer: layer.layer,
      type: 'Effective Rank',
      value: layer.effective_rank_rel,
    }));

    const energyData = data.layers.map((layer) => ({
      layer: layer.layer,
      type: 'Singular Energy',
      value: layer.singular_energy_rel,
    }));

    const chartData = [...rankData, ...energyData];

    const chart = new Line(container, {
      data: chartData,
      ...(autoFit ? { autoFit: true } : { width }),
      height,
      xField: 'layer',
      yField: 'value',
      seriesField: 'type',
      smooth: true,
      color: ['#F6BD16', '#E86452'],
      meta: {
        layer: { type: 'cat', alias: config.xAxisLabel || 'Layer' },
        value: { alias: config.yAxisLabel || 'Value (%)', min: 0, max: 100 },
      },
      tooltip: config.showTooltip !== false ? {} : undefined,
      legend: config.showLegend !== false ? {} : undefined,
      yAxis: {
        min: 0,
        max: 100,
        label: {
          formatter: (v: string) => `${v}%`,
        },
      },
    });

    chart.render();
    chartRef.current = chart;

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
          const chartContainer = (chartRef.current as unknown as { container?: HTMLElement }).container;
          if (chartContainer && chartContainer.parentNode) {
            chartRef.current.destroy();
          }
        } catch {
          // DOM may already be unmounted
        }
        chartRef.current = null;
      }
    };
  }, [data, config, width, height, autoFit]);

  return (
    <div className={styles.chartContainer}>
      {config.title && <h3 className={styles.chartTitle}>{config.title}</h3>}
      <div ref={containerRef} className={styles.chartContent} />
    </div>
  );
};

export default FunnelChart;
