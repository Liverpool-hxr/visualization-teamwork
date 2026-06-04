import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useInspector } from '@/store/inspectorStore';
import styles from './index.module.css';

type TabKey = 'heatmap' | 'analysis' | 'overview';

const tabConfig: Array<{ key: TabKey; label: string; path: string }> = [
  { key: 'heatmap', label: '热力图', path: '/heatmap' },
  { key: 'analysis', label: '分析图表', path: '/analysis' },
  { key: 'overview', label: '模型概览', path: '/overview' },
];

const statusTextMap = {
  idle: '待机',
  busy: '运行中',
  ready: '就绪',
  error: '错误',
} as const;

const TopBarStatic: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useInspector();

  const activeKey = React.useMemo<TabKey>(() => {
    if (location.pathname.startsWith('/analysis')) return 'analysis';
    if (location.pathname.startsWith('/overview')) return 'overview';
    return 'heatmap';
  }, [location.pathname]);

  return (
    <div className={styles.topbar}>
      <div className={styles.logo}>SR</div>
      <div className={styles.title}>
        <strong>MultiVIT SR</strong> Attention Inspector
      </div>

      <div className={styles.tabs}>
        {tabConfig.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeKey === tab.key ? styles.active : ''}`}
            onClick={() => navigate(tab.path)}
            type="button"
          >
            <span className={styles.dot} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.right}>
        <div className={`${styles.statusChip} ${styles[state.status]}`}>
          <span className={styles.statusDot} />
          <span>{statusTextMap[state.status]}</span>
        </div>
      </div>
    </div>
  );
};

export default TopBarStatic;

