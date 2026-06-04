import React, { useMemo, useState } from 'react';
import type { Layer } from '@/types/attention';
import styles from './index.module.css';

interface AttentionTreeProps {
  data: Layer[];
  selected?: { layerId: number; headId: number; patchId: number } | null;
  onSelectPatch?: (params: { layerId: number; headId: number; patchId: number }) => void;
}

const entropyColor = (e: number, mn: number, mx: number) => {
  const t = (e - mn) / (mx - mn + 1e-9);
  return `hsl(${t * 120},65%,50%)`;
};

const AttentionTree: React.FC<AttentionTreeProps> = ({ data, selected, onSelectPatch }) => {
  const [openLayers, setOpenLayers] = useState<Set<number>>(() => new Set([0]));
  const [openHeads, setOpenHeads] = useState<Set<string>>(() => new Set());

  const entropyRange = useMemo(() => {
    const all: number[] = [];
    data.forEach((layer) => {
      all.push(layer.entropy);
      layer.heads.forEach((head) => {
        all.push(head.entropy);
        head.patches.forEach((patch) => all.push(patch.entropy));
      });
    });
    if (all.length === 0) return { mn: 0, mx: 1 };
    return { mn: Math.min(...all), mx: Math.max(...all) };
  }, [data]);

  const toggleLayer = (layerId: number) => {
    setOpenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  };

  const toggleHead = (layerId: number, headId: number) => {
    const key = `${layerId}-${headId}`;
    setOpenHeads((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className={styles.tree}>
      {data.length === 0 ? (
        <div className={styles.empty}>暂无注意力树数据（请先运行模型并加载 /tree_stats）</div>
      ) : (
        data.map((layer) => {
          const layerOpen = openLayers.has(layer.layer_id);
          const layerColor = entropyColor(layer.entropy, entropyRange.mn, entropyRange.mx);

          return (
            <div key={layer.layer_id} className={styles.layer}>
              <div
                className={`${styles.row} ${layerOpen ? styles.open : ''}`}
                onClick={() => toggleLayer(layer.layer_id)}
              >
                <span className={`${styles.arrow} ${layerOpen ? styles.arrowOpen : ''}`}>▶</span>
                <span className={styles.badge} style={{ background: layerColor }} />
                <span className={styles.label}>Layer {layer.layer_id}</span>
                <span className={styles.value}>H={layer.entropy.toFixed(2)}</span>
              </div>

              {layerOpen && (
                <div className={styles.children}>
                  {layer.heads.map((head) => {
                    const headKey = `${layer.layer_id}-${head.head_id}`;
                    const headOpen = openHeads.has(headKey);
                    const headColor = entropyColor(head.entropy, entropyRange.mn, entropyRange.mx);

                    // 与 static/index.html 对齐：固定 8 列（键盘上下移动也按 8 步长）
                    const cols = 8;

                    return (
                      <div key={headKey} className={styles.head}>
                        <div
                          className={`${styles.row} ${styles.rowHead} ${headOpen ? styles.open : ''}`}
                          onClick={() => toggleHead(layer.layer_id, head.head_id)}
                        >
                          <span className={`${styles.arrow} ${headOpen ? styles.arrowOpen : ''}`}>▶</span>
                          <span className={styles.badge} style={{ background: headColor }} />
                          <span className={styles.label}>Head {head.head_id}</span>
                          <span className={styles.value}>H={head.entropy.toFixed(2)}</span>
                          <span className={styles.value}>mx={head.max_attn.toFixed(4)}</span>
                        </div>

                        {headOpen && (
                          <div className={styles.patchGridWrap} onClick={(e) => e.stopPropagation()}>
                            <div
                              className={styles.patchGrid}
                              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                            >
                              {head.patches.map((patch) => {
                                const isSelected =
                                  !!selected &&
                                  selected.layerId === layer.layer_id &&
                                  selected.headId === head.head_id &&
                                  selected.patchId === patch.patch_id;

                                return (
                                  <div
                                    key={patch.patch_id}
                                    className={`${styles.patchCell} ${isSelected ? styles.patchSelected : ''}`}
                                    style={{
                                      background: entropyColor(patch.entropy, entropyRange.mn, entropyRange.mx),
                                    }}
                                    title={`P${patch.patch_id}  H=${patch.entropy.toFixed(3)}  mx=${patch.max_attn.toFixed(4)}`}
                                    onClick={() =>
                                      onSelectPatch?.({
                                        layerId: layer.layer_id,
                                        headId: head.head_id,
                                        patchId: patch.patch_id,
                                      })
                                    }
                                  />
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default AttentionTree;
