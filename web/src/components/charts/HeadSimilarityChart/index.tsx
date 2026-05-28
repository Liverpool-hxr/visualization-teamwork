import React, { useEffect, useRef } from 'react';
import { Heatmap } from '@antv/g2plot';
import type { KLLocalityData, ChartConfig } from '@/types/chart';
import styles from './index.module.css';

interface HeadSimilarityChartProps {
  data: KLLocalityData;
  layerIndex?: number;
  config?: ChartConfig;
  width?: number;
  height?: number;
}

const HeadSimilarityChart: React.FC<HeadSimilarityChartProps> = ({
  data,
  layerIndex = 0,
  config = {},
  width = 600,
  height = 400
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Heatmap | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data) return;

    const layer = data.layers[layerIndex];
    if (!layer) return;

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

    const numHeads = layer.kl_per_head.length;
    const similarityData: { x: number; y: number; value: number }[] = [];

    for (let i = 0; i < numHeads; i++) {
      for (let j = 0; j < numHeads; j++) {
        const klDiff = Math.abs(layer.kl_per_head[i] - layer.kl_per_head[j]);
        const localityDiff = Math.abs(layer.locality_per_head[i] - layer.locality_per_head[j]);
        const similarity = 1 - (klDiff + localityDiff) / 2;
        similarityData.push({
          x: i,
          y: j,
          value: Math.max(0, similarity),
        });
      }
    }

    const chart = new Heatmap(container, {
      data: similarityData,
      width,
      height,
      xField: 'x',
      yField: 'y',
      colorField: 'value',
      color: ['#1E90FF', '#32CD32', '#FFD700', '#FF6347'],
      meta: {
        x: { type: 'cat', alias: config.xAxisLabel || 'Head' },
        y: { type: 'cat', alias: config.yAxisLabel || 'Head' },
        value: { min: 0, max: 1 },
      },
      tooltip: config.showTooltip !== false ? {
        formatter: (datum: unknown) => {
          const d = datum as { x: number; y: number; value: number };
          return {
            name: `Head ${d.x} vs Head ${d.y}`,
            value: `Similarity: ${(d.value * 100).toFixed(1)}%`,
          };
        },
      } : undefined,
      legend: config.showLegend !== false ? {} : undefined,
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
  }, [data, layerIndex, config, width, height]);

  return (
    <div className={styles.chartContainer}>
      {config.title && <h3 className={styles.chartTitle}>{config.title}</h3>}
      <div ref={containerRef} className={styles.chartContent} />
    </div>
  );
};

export default HeadSimilarityChart;
