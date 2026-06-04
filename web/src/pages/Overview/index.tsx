import React, { useMemo } from 'react';
import { useInspector } from '@/store/inspectorStore';
import styles from './index.module.css';

const Overview: React.FC = () => {
  const { state } = useInspector();
  const meta = state.tree?.meta;
  const tree = state.tree;
  const ac = state.analysisCache;

  /* ── Derived stats ── */

  const treeSummary = useMemo(() => {
    if (!tree) return null;
    let patchCount = 0;
    let entropySum = 0;
    let maxAttnSum = 0;
    let peak = 0;

    tree.layers.forEach((l) => {
      l.heads.forEach((h) => {
        h.patches.forEach((p) => {
          patchCount += 1;
          entropySum += p.entropy;
          maxAttnSum += p.max_attn;
          if (p.max_attn > peak) peak = p.max_attn;
        });
      });
    });

    return {
      patchCount,
      avgEntropy: patchCount > 0 ? entropySum / patchCount : 0,
      avgMaxAttn: patchCount > 0 ? maxAttnSum / patchCount : 0,
      peakMaxAttn: peak,
    };
  }, [tree]);

  const layerInsight = useMemo(() => {
    if (!tree) return null;
    const last = tree.layers.length - 1;
    return {
      firstEntropy: tree.layers[0]?.entropy?.toFixed(3),
      lastEntropy: tree.layers[last]?.entropy?.toFixed(3),
      firstMaxAttn: tree.layers[0]?.max_attn?.toFixed(4),
      lastMaxAttn: tree.layers[last]?.max_attn?.toFixed(4),
    };
  }, [tree]);

  const klSummary = useMemo(() => {
    if (!ac.kl) return null;
    const kls = ac.kl.layers.map((l) => l.kl_mean);
    return {
      min: Math.min(...kls).toFixed(4),
      max: Math.max(...kls).toFixed(4),
      baseline: ac.kl.baseline_locality.toFixed(4),
    };
  }, [ac.kl]);

  return (
    <div className={styles.root}>
      <div className={styles.h1}>
        MultiVIT SR <span>Attention Inspector</span>
      </div>
      <div className={styles.sub}>
        图像超分辨率 Transformer 注意力分析工具 — 运行模型后查看各层各头的注意力分布
      </div>

      {/* ── 模型配置 ── */}
      <div className={styles.sectionTitle}>模型配置</div>
      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>输入分辨率</div>
          <div className={styles.cardVal}>64 × 64</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>放大倍数</div>
          <div className={`${styles.cardVal} ${styles.secondary}`}>× 4</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Patch 尺寸</div>
          <div className={`${styles.cardVal} ${styles.tertiary}`}>4 × 4</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Embedding 维度</div>
          <div className={styles.cardVal}>96</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>窗口大小</div>
          <div className={`${styles.cardVal} ${styles.secondary}`}>8</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>输出分辨率</div>
          <div className={`${styles.cardVal} ${styles.tertiary}`}>256 × 256</div>
        </div>
      </div>

      {/* ── 运行时统计（tree_stats） ── */}
      <div className={styles.sectionTitle}>运行时统计</div>
      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>检测到的层数</div>
          <div className={styles.cardVal}>{meta?.num_layers ?? '—'}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>每层注意力头</div>
          <div className={`${styles.cardVal} ${styles.secondary}`}>{meta?.num_heads ?? '—'}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Patch 总数</div>
          <div className={`${styles.cardVal} ${styles.tertiary}`}>{meta?.num_patches ?? '—'}</div>
        </div>
        {treeSummary && (
          <>
            <div className={styles.card}>
              <div className={styles.cardLabel}>总 Patch 计数</div>
              <div className={styles.cardVal}>{treeSummary.patchCount}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>平均熵值</div>
              <div className={`${styles.cardVal} ${styles.secondary}`}>{treeSummary.avgEntropy.toFixed(4)}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>峰值 max_attn</div>
              <div className={`${styles.cardVal} ${styles.tertiary}`}>{treeSummary.peakMaxAttn.toFixed(4)}</div>
            </div>
          </>
        )}
      </div>

      {/* ── 层间对比 ── */}
      {layerInsight && (
        <>
          <div className={styles.sectionTitle}>首尾层对比</div>
          <div className={styles.grid}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Layer 0 熵均值</div>
              <div className={styles.cardVal}>{layerInsight.firstEntropy}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>最后一层熵均值</div>
              <div className={`${styles.cardVal} ${styles.secondary}`}>{layerInsight.lastEntropy}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Layer 0 max_attn</div>
              <div className={`${styles.cardVal} ${styles.tertiary}`}>{layerInsight.firstMaxAttn}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>最后一层 max_attn</div>
              <div className={styles.cardVal}>{layerInsight.lastMaxAttn}</div>
            </div>
          </div>
        </>
      )}

      {/* ── KL 局部性洞察 ── */}
      {klSummary && (
        <>
          <div className={styles.sectionTitle}>KL 散度与局部性概览</div>
          <div className={styles.grid}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>KL 最小值</div>
              <div className={styles.cardVal}>{klSummary.min}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>KL 最大值</div>
              <div className={`${styles.cardVal} ${styles.secondary}`}>{klSummary.max}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>基准局部性</div>
              <div className={`${styles.cardVal} ${styles.tertiary}`}>{klSummary.baseline}</div>
            </div>
          </div>
        </>
      )}

      {/* ── 数据来源 ── */}
      <div className={styles.sectionTitle}>数据来源</div>
      <div className={styles.routes}>
        <div className={styles.routeRow}>
          <span className={styles.methodOk}>NPY</span>
          <span className={styles.path}>attn_list.npy</span>
          <span className={styles.desc}>注意力权重矩阵（前端直接读取并计算所有指标）</span>
        </div>
        <div className={styles.routeRow}>
          <span className={styles.methodOk}>PNG</span>
          <span className={styles.path}>input.png / output.png</span>
          <span className={styles.desc}>输入与超分输出图像</span>
        </div>
        <div className={styles.routeRow}>
          <span className={styles.methodOk}>TS</span>
          <span className={styles.path}>math.ts / npyService.ts</span>
          <span className={styles.desc}>纯前端计算：熵值、KL散度、SVD、热力图Canvas渲染</span>
        </div>
      </div>
    </div>
  );
};

export default Overview;
