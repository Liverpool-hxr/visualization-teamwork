import React, { Suspense } from 'react';
import { Layout } from 'antd';
import TopBarStatic from '@/components/shell/TopBarStatic';
import SidebarStatic from '@/components/shell/SidebarStatic';
import PageTransition from '@/components/common/PageTransition';
import styles from './index.module.css';

const InspectorLayout: React.FC = () => {
  return (
    <Layout className={styles.root}>
      <TopBarStatic />
      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <SidebarStatic />
        </aside>
        <main className={styles.content}>
          <Suspense fallback={<div className={styles.fallback}>Loading…</div>}>
            <PageTransition />
          </Suspense>
        </main>
      </div>
    </Layout>
  );
};

export default InspectorLayout;
