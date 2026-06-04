import React from 'react';
import AttentionTree from '@/components/tree/AttentionTree';
import { useInspector } from '@/store/inspectorStore';
import styles from './index.module.css';

const SidebarStatic: React.FC = () => {
  const { state, actions } = useInspector();
  const [loading, setLoading] = React.useState(false);

  const handleCaseChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const caseName = e.target.value;
    if (!caseName || caseName === state.activeCase) return;
    setLoading(true);
    try {
      await actions.selectCase(caseName);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatch = (params: { layerId: number; headId: number; patchId: number }) => {
    actions.selectPatch(params);
  };

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <div className={styles.label}>选择案例</div>
        <div className={styles.caseSelector}>
          <select
            className={styles.caseSelect}
            value={state.activeCase ?? ''}
            onChange={(e) => void handleCaseChange(e)}
            disabled={loading}
          >
            <option value="" disabled>
              {loading ? '加载中…' : '-- 选择案例 --'}
            </option>
            {state.caseList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {state.activeCase && state.inputUrl && (
          <div className={styles.previewWrap}>
            <img
              className={styles.previewImg}
              src={state.inputUrl}
              alt="input preview"
            />
            <div className={styles.previewMeta}>
              <div className={styles.previewName}>{state.activeCase}</div>
              <div className={styles.previewSize}>
                {state.numLayers}层 {state.numHeads}头 {state.numPatches}patches
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.label}>颜色图例 — 行熵（重要性）</div>
        <div className={styles.legendBar} />
        <div className={styles.legendLabels}>
          <span>低熵 = 高重要性</span>
          <span>高熵 = 低重要性</span>
        </div>
      </div>

      <div className={styles.sectionGrow}>
        <div className={styles.treeWrap}>
          {state.tree?.layers?.length ? (
            <AttentionTree
              data={state.tree.layers}
              selected={state.selected}
              onSelectPatch={handleSelectPatch}
            />
          ) : (
            <div className={styles.treeEmpty}>
              <div className={styles.treeEmptyIcon}>◎</div>
              <div>
                选择一个案例后
                <br />
                自动显示注意力树
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.logBar}>
        {state.logs.map((l, idx) => (
          <div
            key={`${l.ts}-${idx}`}
            className={`${styles.logLine} ${l.level === 'ok' ? styles.logOk : ''} ${
              l.level === 'err' ? styles.logErr : ''
            } ${l.level === 'warn' ? styles.logWarn : ''}`}
          >
            {new Date(l.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}{' '}
            {l.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SidebarStatic;
