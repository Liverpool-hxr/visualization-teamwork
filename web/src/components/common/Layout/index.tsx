import React from 'react';
import { Layout } from 'antd';
import TopBar from '../TopBar';
import Sidebar from '../Sidebar';
import styles from './index.module.css';

const { Content } = Layout;

interface LayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <Layout className={styles.layout}>
      <TopBar />
      <Layout>
        <Sidebar />
        <Content className={styles.content}>{children}</Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;