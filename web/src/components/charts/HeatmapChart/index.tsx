import React, { useEffect, useRef } from 'react';
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
  width = 600,
  height = 400
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Heatmap | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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

    const heatmap = new Heatmap(container, {
      data,
      width,
      height,
      xField: 'x',
      yField: 'y',
      colorField: 'value',
      color: ['#316bf3', '#37a2da', '#5cd85c', '#fff433', '#ff6b6b'],
      meta: {
        x: { type: 'cat', alias: config.xAxisLabel || 'X Axis' },
        y: { type: 'cat', alias: config.yAxisLabel || 'Y Axis' },
        value: { min: 0, max: 1 },
      },
      tooltip: config.showTooltip !== false ? {
        formatter: (datum: unknown) => {
          const d = datum as HeatmapDataPoint;
          return {
            name: `(${d.x}, ${d.y})`,
            value: d.value.toFixed(4),
          };
        },
      } : undefined,
      legend: config.showLegend !== false ? {} : undefined,
    });

    heatmap.render();
    chartRef.current = heatmap;

    return () => {
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
  }, [data, config, width, height]);

  return (
    <div className={styles.chartContainer}>
      {config.title && <h3 className={styles.chartTitle}>{config.title}</h3>}
      <div ref={containerRef} className={styles.chartContent} />
    </div>
  );
};

export default HeatmapChart;
