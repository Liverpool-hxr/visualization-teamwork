import React, { useEffect, useRef } from 'react';
import { Column } from '@antv/g2plot';
import type { ChartConfig, ThreeDBarData } from '@/types/chart';
import styles from './index.module.css';

interface ThreeDBarChartProps {
  data: ThreeDBarData;
  config?: ChartConfig;
  width?: number;
  height?: number;
  baseline?: number;
}

interface ChartDatum {
  layer: number;
  metric: 'row_var_rel' | 'sparsity_rel';
  value: number;
}

const ThreeDBarChart: React.FC<ThreeDBarChartProps> = ({
  data,
  config = {},
  width,
  height = 360,
  baseline = 100,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Column | null>(null);
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
        void 0;
      }
      chartRef.current = null;
    }

    const chartData: ChartDatum[] = data.layers.flatMap((layer) => ([
      { layer: layer.layer, metric: 'row_var_rel', value: layer.row_var_rel },
      { layer: layer.layer, metric: 'sparsity_rel', value: layer.sparsity_rel },
    ]));

    const values = chartData.map((d) => d.value);
    const maxValue = Math.max(baseline, ...values);
    const minValue = Math.min(baseline, ...values);

    const chart = new Column(container, {
      data: chartData,
      ...(autoFit ? { autoFit: true } : { width }),
      height,
      isGroup: true,
      xField: 'layer',
      yField: 'value',
      seriesField: 'metric',
      color: ['#5B8FF9', '#5AD8A6', '#F6BD16'],
      meta: {
        layer: { type: 'cat', alias: config.xAxisLabel || 'Layer' },
        value: { alias: config.yAxisLabel || 'Relative (%)' },
        metric: {
          formatter: (v: string) => {
            if (v === 'row_var_rel') return 'row_var';
            if (v === 'sparsity_rel') return 'sparsity';
            return v;
          },
        },
      },
      tooltip: config.showTooltip !== false ? {} : undefined,
      legend: config.showLegend !== false ? {} : undefined,
      yAxis: {
        min: Math.max(0, Math.floor((minValue - 10) / 10) * 10),
        max: Math.ceil((maxValue + 10) / 10) * 10,
        label: {
          formatter: (v: string) => `${v}%`,
        },
      },
      annotations: [
        {
          type: 'line',
          start: ['min', baseline],
          end: ['max', baseline],
          style: { stroke: '#8c8c8c', lineDash: [4, 4], lineWidth: 1 },
        },
        {
          type: 'text',
          position: ['min', baseline],
          content: `baseline=${baseline}`,
          offsetY: -8,
          style: { fill: '#595959', fontSize: 12 },
        },
      ],
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
          void 0;
        }
        chartRef.current = null;
      }
    };
  }, [autoFit, baseline, config, data, height, width]);

  return (
    <div className={styles.chartContainer}>
      {config.title && <h3 className={styles.chartTitle}>{config.title}</h3>}
      <div ref={containerRef} className={styles.chartContent} />
    </div>
  );
};

export default ThreeDBarChart;
