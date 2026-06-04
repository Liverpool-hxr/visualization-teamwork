import React, { useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import { useInspector } from '@/store/inspectorStore';
import type { KLLocalityData } from '@/types/chart';
import AttentionOverlay from '@/components/charts/AttentionOverlay';
import styles from './index.module.css';

/* ── Head similarity heatmap (ECharts) ──────────────────────── */

const renderHeadSimilarity = (
  container: HTMLDivElement,
  data: KLLocalityData,
  layerIdx: number,
) => {
  const layer = data.layers[layerIdx];
  if (!layer) return;

  const H = layer.kl_per_head.length;
  const gridData: [number, number, number][] = [];

  for (let i = 0; i < H; i += 1) {
    for (let j = 0; j < H; j += 1) {
      const klDiff = Math.abs(layer.kl_per_head[i] - layer.kl_per_head[j]);
      const locDiff = Math.abs(layer.locality_per_head[i] - layer.locality_per_head[j]);
      const sim = Math.max(0, 1 - (klDiff + locDiff) / 2);
      gridData.push([i, j, Math.round(sim * 1000) / 1000]);
    }
  }

  const existing = echarts.getInstanceByDom(container);
  if (existing) existing.dispose();
  const chart = echarts.init(container);

  chart.setOption({
    title: {
      text: `Layer ${layerIdx} 头间相似度热力图`,
      left: 'center',
      textStyle: { color: '#e8edf5', fontSize: 11 },
    },
    tooltip: {
      formatter: (p: unknown) => {
        const item = (p as { data: [number, number, number] }).data;
        return `Head ${item[0]} ↔ Head ${item[1]}<br/>相似度: ${(item[2] * 100).toFixed(1)}%`;
      },
    },
    grid: { top: 32, bottom: 34, left: 40, right: 20 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: H }, (_, i) => `H${i}`),
      axisLabel: { color: '#8fa3bf', fontSize: 10 },
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: Array.from({ length: H }, (_, i) => `H${i}`),
      axisLabel: { color: '#8fa3bf', fontSize: 10 },
      splitArea: { show: true },
    },
    visualMap: {
      min: 0,
      max: 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: { color: ['#1a2233', '#4da6ff', '#00d4aa', '#f0b429'] },
      textStyle: { color: '#8fa3bf' },
    },
    series: [
      {
        type: 'heatmap',
        data: gridData,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
      },
    ],
  });

  window.addEventListener('resize', () => chart.resize());
};

/* ── Page ───────────────────────────────────────────────────── */

const Heatmap: React.FC = () => {
  const { state, actions } = useInspector();
  const sel = state.selected;

  const headSimRef = useRef<HTMLDivElement | null>(null);

  const [simLayerIdx, setSimLayerIdx] = React.useState(0);
  const [simLoading, setSimLoading] = React.useState(false);

  const klData = state.analysisCache.kl ?? null;
  const simLoaded = klData !== null;
  const effectiveSimLayer = sel ? sel.layerId : simLayerIdx;

  const loadKlData = React.useCallback(async () => {
    if (klData || simLoading) return;
    setSimLoading(true);
    try {
      await actions.loadAnalysis('kl');
    } finally {
      setSimLoading(false);
    }
  }, [klData, simLoading, actions]);

  // Auto-load KL data when case is available
  React.useEffect(() => {
    if (state.activeCase && !klData && !simLoading) {
      void loadKlData();
    }
  }, [state.activeCase, klData, simLoading, loadKlData]);

  React.useEffect(() => {
    if (klData && headSimRef.current) {
      renderHeadSimilarity(headSimRef.current, klData, effectiveSimLayer);
    }
  }, [klData, effectiveSimLayer]);

  const layerOptions = useMemo(() => {
    if (!state.tree) return [];
    return state.tree.layers.map((l) => ({ value: l.layer_id, label: `Layer ${l.layer_id}` }));
  }, [state.tree]);

  const hasHeatmap = state.heatmapMatrix !== null && state.inputUrl !== null && state.outputUrl !== null && sel !== null;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.title}>Attention Heatmap</div>
        <div className={styles.badges}>
          <span className={styles.badge}>Layer {sel ? sel.layerId : '—'}</span>
          <span className={styles.badge}>Head {sel ? sel.headId : '—'}</span>
          <span className={styles.badge}>Patch {sel ? sel.patchId : '—'}</span>
        </div>
      </div>

      <div className={styles.body}>
        {hasHeatmap ? (
          <AttentionOverlay
            inputUrl={state.inputUrl!}
            outputUrl={state.outputUrl!}
            attnMatrix={state.heatmapMatrix}
            patchId={sel!.patchId}
          />
        ) : (
          <div className={styles.emptySection}>
            <div className={styles.emptyIcon}>⌘</div>
            <h3>选择 Patch 查看注意力热力图</h3>
            <p>
              1. 在左侧选择案例
              <br />
              2. 展开左侧树节点
              <br />
              3. 点击任意 Patch 格子
            </p>
          </div>
        )}

        {/* ── Head similarity section ── */}
        <div className={styles.similaritySection}>
          <div className={styles.simHeader}>
            <span className={styles.simTitle}>头间相似度热力图</span>
            {simLoading ? (
              <span className={styles.simLabel}>加载中…</span>
            ) : !simLoaded ? (
              <button
                type="button"
                className={styles.simLoadBtn}
                onClick={() => void loadKlData()}
              >
                加载头相似度
              </button>
            ) : !sel ? (
              <select
                className={styles.simSelect}
                value={simLayerIdx}
                onChange={(e) => setSimLayerIdx(Number(e.target.value))}
              >
                {layerOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className={styles.simLabel}>Layer {sel.layerId}</span>
            )}
          </div>
          <div className={styles.simBody}>
            {simLoaded ? (
              <div className={styles.simChart} ref={headSimRef} />
            ) : (
              <div className={styles.simPlaceholder}>
                {state.activeCase
                  ? '点击按钮加载基于 KL 散度与局部性得分的头间相似度矩阵'
                  : '请先选择一个案例'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Heatmap;
