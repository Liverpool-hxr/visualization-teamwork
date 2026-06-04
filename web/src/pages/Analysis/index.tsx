import React from 'react';
import * as echarts from 'echarts';
import { useInspector } from '@/store/inspectorStore';
import type { FunnelData, KLLocalityData, ThreeDBarData } from '@/types/chart';
import styles from './index.module.css';

type ChartKey = 'kl' | 'fn' | '3d';

const renderChart = (container: HTMLDivElement, option: echarts.EChartsOption) => {
  const existing = echarts.getInstanceByDom(container);
  if (existing) existing.dispose();
  const chart = echarts.init(container);
  chart.setOption(option);
  window.addEventListener('resize', () => chart.resize());
  return chart;
};

const renderKL_Locality = (data: KLLocalityData, container: HTMLDivElement) => {
  const { layers } = data;
  const H = layers[0]?.kl_per_head.length ?? 0;
  const series: echarts.SeriesOption[] = [];
  for (let h = 0; h < H; h += 1) {
    series.push({
      name: `KL H${h}`,
      type: 'line',
      data: layers.map((l) => l.kl_per_head[h]),
      lineStyle: { width: 1, type: 'dashed' },
      symbol: 'none',
      emphasis: { focus: 'series' },
    });
  }
  series.push({
    name: 'KL 均值',
    type: 'line',
    data: layers.map((l) => l.kl_mean),
    lineStyle: { width: 2.5, color: '#00d4aa' },
    symbol: 'circle',
    symbolSize: 6,
    emphasis: { focus: 'series' },
  });

  renderChart(container, {
    title: { text: 'KL散度逐层趋势', left: 'center', textStyle: { color: '#e8edf5', fontSize: 11 } },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { color: '#8fa3bf', fontSize: 10 } },
    grid: { top: 36, bottom: 52, left: 52, right: 24 },
    xAxis: { type: 'category', data: layers.map((_, i) => `L${i}`), axisLabel: { color: '#8fa3bf' } },
    yAxis: { type: 'value', name: 'KL散度', axisLabel: { color: '#8fa3bf' } },
    series,
  });
};

const renderFunnel = (data: FunnelData, container: HTMLDivElement) => {
  const { layers } = data;

  const raw = layers.map((l) => ({
    name: `L${l.layer}`,
    eff: l.effective_rank_rel,
    sve: l.singular_energy_rel,
    value: l.effective_rank_rel * (l.singular_energy_rel / 100),
  }));

  const sveList = raw.map((r) => r.sve);
  const sveMin = Math.min(...sveList);
  const sveMax = Math.max(...sveList);

  renderChart(container, {
    title: { text: '有效秩 × 奇异能量南丁格尔玫瑰图', left: 'center', top: 4, textStyle: { color: '#e8edf5', fontSize: 11 } },
    tooltip: {
      trigger: 'item',
      formatter: (p: unknown) => {
        const d = p as { name: string; value: number; data: { eff: number; sve: number } };
        return `${d.name}<br/>有效秩: ${d.data.eff.toFixed(2)}%<br/>奇异能量: ${d.data.sve.toFixed(2)}%`;
      },
    },
    series: [
      {
        name: '复合指标',
        type: 'pie',
        radius: ['24%', '74%'],
        center: ['50%', '46%'],
        roseType: 'area',
        itemStyle: { borderRadius: 4 },
        label: { formatter: '{b}', fontSize: 10, color: '#8fa3bf' },
        data: raw.map((r) => ({
          ...r,
          itemStyle: {
            color: (() => {
              const t = sveMax > sveMin ? (r.sve - sveMin) / (sveMax - sveMin) : 0.5;
              const rr = Math.round(74 + t * 180);
              const gg = Math.round(86 + t * 80);
              const bb = Math.round(170 - t * 90);
              return `rgb(${rr},${gg},${bb})`;
            })(),
          },
        })),
      },
    ],
  });
};

const render3D = (data: ThreeDBarData, container: HTMLDivElement) => {
  const { layers } = data;
  renderChart(container, {
    title: { text: '退化指标极坐标图（相对于 L0）', left: 'center', top: 2, textStyle: { color: '#e8edf5', fontSize: 11 } },
    tooltip: {},
    legend: { bottom: 0, textStyle: { color: '#8fa3bf', fontSize: 10 }, data: ['行方差', '稀疏度'] },
    polar: { radius: ['22%', '62%'] },
    angleAxis: { type: 'category', data: layers.map((l) => `L${l.layer}`), axisLabel: { color: '#8fa3bf' } },
    radiusAxis: { axisLabel: { color: '#8fa3bf' } },
    series: [
      { name: '行方差', type: 'bar', coordinateSystem: 'polar', data: layers.map((l) => l.row_var_rel), itemStyle: { color: '#4da6ff' } },
      { name: '稀疏度', type: 'bar', coordinateSystem: 'polar', data: layers.map((l) => l.sparsity_rel), itemStyle: { color: '#f0b429' } },
    ],
  });
};

const chartMeta: Record<ChartKey, { label: string; dot: string; cacheKey: 'kl' | 'fn' | 'bar3d' }> = {
  kl: { label: 'KL散度 / 局部性', dot: '#00d4aa', cacheKey: 'kl' },
  fn: { label: '南丁格尔玫瑰图', dot: '#4da6ff', cacheKey: 'fn' },
  '3d': { label: '3D 退化指标', dot: '#b48eff', cacheKey: 'bar3d' },
};

const renderByKey = (key: ChartKey, data: unknown, container: HTMLDivElement) => {
  if (key === 'kl') renderKL_Locality(data as KLLocalityData, container);
  if (key === 'fn') renderFunnel(data as FunnelData, container);
  if (key === '3d') render3D(data as ThreeDBarData, container);
};

const Analysis: React.FC = () => {
  const { state, actions } = useInspector();
  const [loadedKeys, setLoadedKeys] = React.useState<ChartKey[]>([]);
  const [loadingKeys, setLoadingKeys] = React.useState<Set<ChartKey>>(() => new Set());

  const containerRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const cachedKeys = React.useMemo<ChartKey[]>(() => {
    const next: ChartKey[] = [];
    if (state.analysisCache.kl) next.push('kl');
    if (state.analysisCache.fn) next.push('fn');
    if (state.analysisCache.bar3d) next.push('3d');
    return next;
  }, [state.analysisCache.bar3d, state.analysisCache.fn, state.analysisCache.kl]);

  const displayKeys = React.useMemo<ChartKey[]>(() => {
    const set = new Set<ChartKey>([...cachedKeys, ...loadedKeys]);
    return Array.from(set);
  }, [cachedKeys, loadedKeys]);

  const loadOne = async (key: ChartKey) => {
    const meta = chartMeta[key];
    const container = containerRefs.current[key];
    if (!container) return;

    const cached = state.analysisCache[meta.cacheKey];
    if (cached) {
      renderByKey(key, cached, container);
      setLoadedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      return;
    }

    setLoadingKeys((prev) => new Set(prev).add(key));
    actions.setStatus('busy');
    actions.pushLog('warn', `加载分析: ${meta.label}`);

    try {
      const data = await actions.loadAnalysis(meta.cacheKey);
      if (data && containerRefs.current[key]) {
        renderByKey(key, data as KLLocalityData | FunnelData | ThreeDBarData, containerRefs.current[key]!);
      }
      setLoadedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      actions.pushLog('ok', `分析完成: ${meta.label}`);
      actions.setStatus('ready');
    } catch (e) {
      actions.pushLog('err', `分析失败: ${e instanceof Error ? e.message : String(e)}`);
      actions.setStatus('error');
      const wrap = container.parentElement;
      if (wrap) {
        wrap.innerHTML = `<div style="padding:20px;color:#ff5f57">${e instanceof Error ? e.message : String(e)}</div>`;
      }
    } finally {
      setLoadingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const loadAll = async () => {
    const keys: ChartKey[] = ['kl', 'fn', '3d'];
    await Promise.all(keys.map((k) => loadOne(k)));
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.title}>分析图表</div>
        <div className={styles.controls}>
          <button
            type="button"
            className={`${styles.btn} ${displayKeys.includes('kl') ? styles.loaded : ''} ${
              loadingKeys.has('kl') ? styles.loading : ''
            }`}
            onClick={() => void loadOne('kl')}
          >
            KL / 局部性
          </button>
          <button
            type="button"
            className={`${styles.btn} ${displayKeys.includes('fn') ? styles.loaded : ''} ${
              loadingKeys.has('fn') ? styles.loading : ''
            }`}
            onClick={() => void loadOne('fn')}
          >
            玫瑰图
          </button>
          <button
            type="button"
            className={`${styles.btn} ${displayKeys.includes('3d') ? styles.loaded : ''} ${
              loadingKeys.has('3d') ? styles.loading : ''
            }`}
            onClick={() => void loadOne('3d')}
          >
            3D 指标
          </button>
          <button type="button" className={styles.btn} onClick={() => void loadAll()}>
            全部加载
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {displayKeys.length === 0 ? (
          <div className={styles.empty}>选择案例后点击上方按钮加载分析图表，或"全部加载"一次获取所有结果</div>
        ) : null}

        {displayKeys.map((key) => {
          const meta = chartMeta[key];
          return (
            <div key={key} className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardDot} style={{ background: meta.dot }} />
                <span>{meta.label}</span>
              </div>
              <div className={styles.cardBody}>
                <div
                  className={styles.chart}
                  ref={(el) => {
                    containerRefs.current[key] = el;
                    if (el) {
                      const cached = state.analysisCache[meta.cacheKey];
                      if (!cached) return;
                      renderByKey(key, cached, el);
                    }
                  }}
                />
              </div>
            </div>
          );
        })}

        {(['kl', 'fn', '3d'] as ChartKey[]).map((key) => {
          if (displayKeys.includes(key)) return null;
          return (
            <div key={`pre-${key}`} className={styles.hiddenPreload}>
              <div ref={(el) => { containerRefs.current[key] = el; }} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Analysis;
