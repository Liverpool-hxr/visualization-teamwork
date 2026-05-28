import React, { useEffect, useRef } from 'react';
import { Bar } from '@antv/g2plot';
import type { FunnelData, ChartConfig } from '@/types/chart';
import styles from './index.module.css';

interface DegradeChartProps {
  data: FunnelData;
  config?: ChartConfig;
  width?: number;
  height?: number;
}

const DegradeChart: React.FC<DegradeChartProps> = ({
  data,
  config = {},
  width = 600,
  height = 400
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Bar | null>(null);

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

    const degradationData = data.layers.map((layer) => ({
      layer: `Layer ${layer.layer}`,
      effective_rank_degrade: 100 - layer.effective_rank_rel,
      singular_energy_degrade: 100 - layer.singular_energy_rel,
    }));

    const chartData = degradationData.flatMap((item) => [
      { layer: item.layer, type: 'Rank Degradation', value: item.effective_rank_degrade },
      { layer: item.layer, type: 'Energy Degradation', value: item.singular_energy_degrade },
    ]);

    const chart = new Bar(container, {
      data: chartData,
      width,
      height,
      xField: 'layer',
      yField: 'value',
      seriesField: 'type',
      color: ['#F56C6C', '#E6A23C'],
      meta: {
        layer: { type: 'cat', alias: config.xAxisLabel || 'Layer' },
        value: { alias: config.yAxisLabel || 'Degradation (%)', min: 0, max: 100 },
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
      barWidthRatio: 0.6,
    });

    chart.render();
    chartRef.current = chart;

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

export default DegradeChart;
