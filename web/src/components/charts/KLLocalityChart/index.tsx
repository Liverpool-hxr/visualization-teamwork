import React, { useEffect, useRef } from 'react';
import { Line } from '@antv/g2plot';
import type { KLLocalityData, ChartConfig } from '@/types/chart';
import styles from './index.module.css';

interface KLLocalityChartProps {
  data: KLLocalityData;
  config?: ChartConfig;
  width?: number;
  height?: number;
}

const KLLocalityChart: React.FC<KLLocalityChartProps> = ({
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

    const klData = data.layers.map((layer) => ({
      layer: layer.layer,
      type: 'KL Divergence',
      value: layer.kl_mean,
    }));

    const localityData = data.layers.map((layer) => ({
      layer: layer.layer,
      type: 'Locality',
      value: layer.locality_mean,
    }));

    const chartData = [...klData, ...localityData];

    const chart = new Line(container, {
      data: chartData,
      ...(autoFit ? { autoFit: true } : { width }),
      height,
      xField: 'layer',
      yField: 'value',
      seriesField: 'type',
      smooth: true,
      color: ['#5B8FF9', '#5AD8A6'],
      meta: {
        layer: { type: 'cat', alias: config.xAxisLabel || 'Layer' },
        value: { alias: config.yAxisLabel || 'Value' },
      },
      tooltip: config.showTooltip !== false ? {} : undefined,
      legend: config.showLegend !== false ? {} : undefined,
      yAxis: {
        min: 0,
        max: 0.5,
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

export default KLLocalityChart;
